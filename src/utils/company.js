const { EmbedBuilder } = require('discord.js');
const Company = require('../models/Company');
const User = require('../models/User');
const { company: cfg, colors } = require('../config');
const { formatCoin } = require('./format');

const H = 60 * 60 * 1000;
const DAY = 24 * H;
const VN_OFFSET = 7 * H; // Việt Nam UTC+7, không có giờ mùa hè

const industryMap = new Map(cfg.industries.map((i) => [i.key, i]));
const scaleMap = new Map(cfg.scales.map((s) => [s.key, s]));
const num = (n) => Math.round(n).toLocaleString('vi-VN');

// ---------- Thời gian theo giờ Việt Nam ----------
const dayKey = (ms) => new Date(ms + VN_OFFSET).toISOString().slice(0, 10);
const dayStart = (key) => Date.parse(`${key}T00:00:00.000Z`) - VN_OFFSET;
const nextDayKey = (key) => dayKey(dayStart(key) + DAY);

// ---------- Khóa theo người dùng (tránh xử lý chồng chéo) ----------
const locks = new Map();
async function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((r) => (release = r));
  const chain = prev.then(() => next);
  locks.set(key, chain);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === chain) locks.delete(key);
  }
}

// ---------- Số ngẫu nhiên cố định theo (người chơi, ngày) ----------
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Tính toán ----------
function levelOf(c, key) {
  const v = Math.floor(Number((c.levels || {})[key]) || 0);
  return Math.min(cfg.maxLevel, Math.max(0, v));
}

function upgradeCost(c, level) {
  const raw = c.capital * cfg.upgradeCost.basePct * Math.pow(cfg.upgradeCost.growth, level);
  return Math.max(cfg.upgradeCost.min, Math.round(raw / 10) * 10);
}

function getOpenInfo(industryKeys, scaleKey) {
  const inds = industryKeys.map((k) => industryMap.get(k));
  const scale = scaleMap.get(scaleKey);
  const cost = Math.round(inds.reduce((s, i) => s + i.capital, 0) * scale.multiplier);
  let rate = inds.reduce((p, i) => p * i.successRate, 1);
  if (inds.length > 1) rate *= cfg.multiIndustry.successMult;
  return { inds, scale, cost, rate };
}

function calcStats(c) {
  const mult = c.scaleMultiplier || 1;
  const inds = c.industries.map((k) => industryMap.get(k)).filter(Boolean);

  let baseRev = 0;
  let baseBill = 0;
  for (const i of inds) {
    baseRev += i.capital * mult * i.revenueRate;
    baseBill += i.capital * mult * i.billRate;
  }
  if (inds.length > 1) baseRev *= cfg.multiIndustry.revenueMult;

  let revMult = 1;
  let billMult = 1;
  let shield = 0;
  let riskCut = 0;
  for (const u of cfg.upgrades) {
    const l = levelOf(c, u.key);
    revMult += l * (u.revenuePerLevel || 0);
    billMult += l * (u.billPerLevel || 0);
    shield += l * (u.shieldPerLevel || 0);
    riskCut += l * (u.riskPerLevel || 0);
  }
  billMult = Math.max(0.5, billMult);
  shield = Math.min(0.8, shield);

  const pressure = Math.min(cfg.pressure.max, (c.idleDays || 0) * cfg.pressure.perIdleDay * (1 - shield));
  const dailyRevenue = baseRev * revMult * (1 - pressure);
  const dailyBill = baseBill * billMult * (1 + pressure);

  return { dailyRevenue, dailyBill, hourlyRevenue: dailyRevenue / 24, pressure, riskCut, inds };
}

function rollEvent(c, day, stats, fraction) {
  const rng = mulberry32(hashString(`${c.userId}:${day}`));
  let vol = stats.inds.reduce((s, i) => s + i.volatility, 0) / Math.max(1, stats.inds.length);
  if (stats.inds.length > 1) vol *= cfg.multiIndustry.eventRiskMult;
  if (rng() >= vol) return null;

  const badShare = Math.max(0.15, 0.6 - stats.riskCut);
  const bad = rng() < badShare;
  const pool = cfg.events.filter((e) => e.kind === (bad ? 'bad' : 'good'));
  if (!pool.length) return null;
  const e = pool[Math.floor(rng() * pool.length)];
  const base = e.base === 'revenue' ? stats.dailyRevenue : stats.dailyBill;
  const amount = Math.round(base * e.pct * fraction);
  return { name: e.name, delta: bad ? -amount : amount };
}

// ---------- Hiển thị ----------
function billLine(h) {
  const [, m, d] = h.day.split('-');
  const net = h.revenue - h.expenses + h.eventDelta;
  const ev = h.eventName
    ? `\n↳ ${h.eventName}${h.eventDelta ? `: ${h.eventDelta >= 0 ? '+' : '-'}${num(Math.abs(h.eventDelta))}` : ''}`
    : '';
  return `**${d}/${m}** · Doanh thu +${num(h.revenue)} · Bill -${num(h.expenses)} · Ròng **${net >= 0 ? '+' : '-'}${num(Math.abs(net))}**${ev}`;
}

function billEmbed(entries, balance) {
  const shown = entries.slice(-8);
  const lines = shown.map(billLine);
  if (entries.length > shown.length) lines.unshift(`...và ${entries.length - shown.length} ngày trước đó`);
  return new EmbedBuilder()
    .setColor(balance < 0 ? colors.error : colors.warning)
    .setTitle('Bill công ty 🧾')
    .setDescription(lines.join('\n'))
    .addFields({ name: 'Ví hiện tại', value: formatCoin(balance) })
    .setFooter({ text: 'Dùng /nangcapkn để giữ doanh thu cao hơn bill' });
}

async function sendDM(client, userId, embed) {
  if (!client) return;
  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
  } catch {
    // người dùng đóng DM, bỏ qua (vẫn xem lại được bằng /xembillkn)
  }
}

async function getBalance(userId) {
  const u = await User.findOne({ userId }).select('balance');
  return u ? u.balance : 0;
}

// ---------- Cộng doanh thu theo giờ vào ví ----------
// whole = true: chỉ cộng số giờ trọn. false: cộng đến đúng mốc (dùng khi chốt bill lúc 00:00).
async function accrue(c, untilMs, whole) {
  let ms = untilMs - c.accruedUntil.getTime();
  if (whole) ms = Math.floor(ms / H) * H;
  if (ms <= 0) return c;

  const revenue = Math.floor((calcStats(c).hourlyRevenue * ms) / H);
  const updated = await Company.findOneAndUpdate(
    { _id: c._id, status: 'active', accruedUntil: c.accruedUntil },
    {
      $set: { accruedUntil: new Date(c.accruedUntil.getTime() + ms) },
      $inc: { dayRevenue: revenue, totalRevenue: revenue },
    },
    { new: true }
  );
  if (!updated) return null; // đã bị xử lý ở nơi khác
  if (revenue > 0) await User.updateOne({ userId: c.userId }, { $inc: { balance: revenue } });
  return updated;
}

// ---------- Chốt bill 1 ngày ----------
async function billDay(c, boundary) {
  const day = c.nextBillDay;
  const accrued = await accrue(c, boundary, false);
  if (!accrued) return null;
  c = accrued;

  const activeFrom = Math.max(c.openedAt.getTime(), dayStart(day));
  const fraction = Math.max(0, Math.min(1, (boundary - activeFrom) / DAY));
  const stats = calcStats(c);
  const expenses = Math.round(stats.dailyBill * fraction);
  const ev = rollEvent(c, day, stats, fraction);
  const eventDelta = ev ? ev.delta : 0;

  // Bỏ bê thì áp lực tăng và các chỉ số tụt dần
  const upgradedToday = c.upgradedDay === day;
  const allMax = cfg.upgrades.every((u) => levelOf(c, u.key) >= cfg.maxLevel);
  const idle = upgradedToday || allMax ? 0 : (c.idleDays || 0) + 1;
  const set = { nextBillDay: nextDayKey(day), dayRevenue: 0, idleDays: idle };
  if (!upgradedToday && !allMax) {
    for (const u of cfg.upgrades) {
      const l = levelOf(c, u.key);
      if (u.decayEvery && l > 0 && idle % u.decayEvery === 0) set[`levels.${u.key}`] = l - 1;
    }
  }

  const entry = {
    day,
    revenue: c.dayRevenue || 0,
    expenses,
    eventName: ev ? ev.name : '',
    eventDelta,
  };

  const updated = await Company.findOneAndUpdate(
    { _id: c._id, status: 'active', nextBillDay: day },
    {
      $set: set,
      $inc: { totalExpenses: expenses },
      $push: { history: { $each: [entry], $slice: -cfg.historyDays } },
    },
    { new: true }
  );
  if (!updated) return null;

  const delta = eventDelta - expenses;
  if (delta !== 0) await User.updateOne({ userId: c.userId }, { $inc: { balance: delta } });
  return entry;
}

// ---------- Phá sản + cảnh báo ----------
async function declareBankrupt(client, c) {
  const now = new Date();
  const closed = await Company.findOneAndUpdate(
    { _id: c._id, status: 'active' },
    {
      $set: {
        status: 'bankrupt',
        closedAt: now,
        bannedUntil: new Date(now.getTime() + cfg.bankruptBanDays * DAY),
      },
    }
  );
  if (!closed) return;

  await User.updateOne({ userId: c.userId, balance: { $lt: cfg.resetWalletTo } }, { $set: { balance: cfg.resetWalletTo } });

  const embed = new EmbedBuilder()
    .setColor(colors.error)
    .setTitle('Công ty đã phá sản 💥')
    .setDescription(
      `Ví của bạn đã chạm mức ${formatCoin(cfg.bankruptcyLimit)} nên công ty phải đóng cửa. Wiki Chan đã xóa nợ trong ví về ${formatCoin(cfg.resetWalletTo)}. Bạn bị cấm khởi nghiệp lại trong ${cfg.bankruptBanDays} ngày.`
    );
  await sendDM(client, c.userId, embed);
}

async function checkWallet(client, userId) {
  const c = await Company.findOne({ userId, status: 'active' });
  if (!c) return;

  const balance = await getBalance(userId);
  if (balance <= cfg.bankruptcyLimit) return declareBankrupt(client, c);

  const reached = cfg.warnLevels.filter((l) => balance <= l).length;
  const prev = c.warnLevel || 0;
  if (reached === prev) return;

  await Company.updateOne({ _id: c._id }, { $set: { warnLevel: reached } });
  if (reached > prev) {
    const embed = new EmbedBuilder()
      .setColor(colors.error)
      .setTitle('Cảnh báo: công ty đang lỗ nặng ⚠️')
      .setDescription(
        `Ví của bạn đang ở mức ${formatCoin(balance)}. Chạm ${formatCoin(cfg.bankruptcyLimit)} là công ty phá sản. Hãy dùng /nangcapkn để tăng doanh thu hoặc giải thể bằng /gt.`
      );
    await sendDM(client, userId, embed);
  }
}

// ---------- Xử lý 1 công ty (không khóa) ----------
async function settleUnlocked(client, userId) {
  const summaries = [];

  for (let i = 0; i <= cfg.maxCatchUpDays; i++) {
    const c = await Company.findOne({ userId, status: 'active' });
    if (!c) break;

    const boundary = dayStart(c.nextBillDay) + DAY;
    if (Date.now() < boundary) {
      await accrue(c, Date.now(), true);
      break;
    }

    const entry = await billDay(c, boundary);
    if (!entry) break;
    summaries.push(entry);

    if ((await getBalance(userId)) <= cfg.bankruptcyLimit) break;
  }

  if (summaries.length) await sendDM(client, userId, billEmbed(summaries, await getBalance(userId)));
  await checkWallet(client, userId);
  return summaries;
}

function settleCompany(client, userId) {
  return withLock(userId, () => settleUnlocked(client, userId));
}

// ---------- Giải thể: bill hôm nay vẫn tính đủ cả ngày ----------
function dissolveCompany(client, userId) {
  return withLock(userId, async () => {
    await settleUnlocked(client, userId);

    let c = await Company.findOne({ userId, status: 'active' });
    if (!c) return null;
    c = await accrue(c, Date.now(), true);
    if (!c) return null;

    const now = new Date();
    const bill = Math.round(calcStats(c).dailyBill);
    const entry = {
      day: dayKey(now.getTime()),
      revenue: c.dayRevenue || 0,
      expenses: bill,
      eventName: 'Giải thể công ty',
      eventDelta: 0,
    };

    const closed = await Company.findOneAndUpdate(
      { _id: c._id, status: 'active' },
      {
        $set: { status: 'dissolved', closedAt: now },
        $inc: { totalExpenses: bill },
        $push: { history: { $each: [entry], $slice: -cfg.historyDays } },
      }
    );
    if (!closed) return null;

    if (bill > 0) await User.updateOne({ userId }, { $inc: { balance: -bill } });
    return { bill, balance: await getBalance(userId), entry };
  });
}

// ---------- Bộ quét định kỳ ----------
let sweeping = false;
function startCompanySweeper(client) {
  const run = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      const list = await Company.find({ status: 'active' }).select('userId').lean();
      for (const { userId } of list) {
        try {
          await settleCompany(client, userId);
        } catch (err) {
          console.error(`[Công ty] Lỗi khi xử lý ${userId}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Công ty] Lỗi khi quét:', err.message);
    } finally {
      sweeping = false;
    }
  };
  run(); // chạy ngay khi bật bot để bù bill những ngày bot tắt
  setInterval(run, cfg.sweepIntervalMs);
}

module.exports = {
  H,
  DAY,
  dayKey,
  dayStart,
  industryMap,
  scaleMap,
  levelOf,
  upgradeCost,
  getOpenInfo,
  calcStats,
  billLine,
  settleCompany,
  dissolveCompany,
  startCompanySweeper,
};

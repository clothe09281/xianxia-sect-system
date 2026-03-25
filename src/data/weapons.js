export const WEAPONS_MASTER = {
  weapon_001: {
    id: "weapon_001",
    name: "青雲短刃",
    icon: "/merchandise/weapon_001.png",
    requiredLevel: 20,
    baseHp: 0,
    baseAtk: 20,
    baseSpd: 5,
    xpBonus: 5,
    skillName: "疾風斬",
    skillDesc: "答對時額外增加少量戰力。",
    desc: "輕靈迅捷，適合敏捷型修士。",
  },

  weapon_002: {
    id: "weapon_002",
    name: "破曉長弓",
    icon: "/merchandise/weapon_002.png",
    requiredLevel: 20,
    baseHp: 0,
    baseAtk: 18,
    baseSpd: 8,
    xpBonus: 5,
    skillName: "追風箭",
    skillDesc: "答對時額外獲得少量修為。",
    desc: "遠距神兵，擅長速度與連擊。",
  },

  weapon_003: {
    id: "weapon_003",
    name: "玄影雙刃",
    icon: "/merchandise/weapon_003.png",
    requiredLevel: 30,
    baseHp: 0,
    baseAtk: 26,
    baseSpd: 7,
    xpBonus: 6,
    skillName: "雙影連襲",
    skillDesc: "答對時額外增加戰力與少量妖丹。",
    desc: "雙刃齊出，近戰爆發強勢。",
  },

  weapon_004: {
    id: "weapon_004",
    name: "真炎龍槍",
    icon: "/merchandise/weapon_004.png",
    requiredLevel: 40,
    baseHp: 15,
    baseAtk: 32,
    baseSpd: 5,
    xpBonus: 7,
    skillName: "炎龍貫日",
    skillDesc: "歷練或答題時，提高攻擊型加成。",
    desc: "槍勢如龍，剛猛迅疾。",
  },

  weapon_005: {
    id: "weapon_005",
    name: "雷霆戰戟",
    icon: "/merchandise/weapon_005.png",
    requiredLevel: 50,
    baseHp: 20,
    baseAtk: 36,
    baseSpd: 4,
    xpBonus: 8,
    skillName: "九霄雷斬",
    skillDesc: "提高總戰力的爆發表現。",
    desc: "雷霆震地，氣勢驚人。",
  },

  weapon_006: {
    id: "weapon_006",
    name: "星辰古劍",
    icon: "/merchandise/weapon_006.png",
    requiredLevel: 50,
    baseHp: 10,
    baseAtk: 34,
    baseSpd: 6,
    xpBonus: 8,
    skillName: "星輝劍意",
    skillDesc: "提高穩定輸出與修為成長。",
    desc: "古劍蘊星輝，劍勢沉穩。",
  },

  weapon_007: {
    id: "weapon_007",
    name: "無極天刃",
    icon: "/merchandise/weapon_007.png",
    requiredLevel: 60,
    baseHp: 18,
    baseAtk: 40,
    baseSpd: 6,
    xpBonus: 10,
    skillName: "天刃無極",
    skillDesc: "提高高階戰力與攻擊型成長。",
    desc: "鋒芒凌厲，霸道無匹。",
  },

  weapon_008: {
    id: "weapon_008",
    name: "月華流光劍",
    icon: "/merchandise/weapon_008.png",
    requiredLevel: 70,
    baseHp: 12,
    baseAtk: 42,
    baseSpd: 8,
    xpBonus: 12,
    skillName: "月流千影",
    skillDesc: "提高速度與華麗連擊表現。",
    desc: "月華流轉，輕靈飄逸。",
  },

  weapon_009: {
    id: "weapon_009",
    name: "蒼嵐重劍",
    icon: "/merchandise/weapon_009.png",
    requiredLevel: 70,
    baseHp: 28,
    baseAtk: 45,
    baseSpd: 3,
    xpBonus: 12,
    skillName: "嵐岳斷空",
    skillDesc: "提高厚重壓制與高血量優勢。",
    desc: "重劍如山，勢不可擋。",
  },

  weapon_010: {
    id: "weapon_010",
    name: "太虛玄刀",
    icon: "/merchandise/weapon_010.png",
    requiredLevel: 80,
    baseHp: 18,
    baseAtk: 50,
    baseSpd: 7,
    xpBonus: 15,
    skillName: "太虛裂界",
    skillDesc: "神兵巔峰，全面提升總戰力。",
    desc: "刀勢裂空，威壓四方。",
  },
};

// ===============================
// 基礎神兵戰力
// ===============================
export function calcWeaponPower(weapon) {
  if (!weapon) return 0;

  return Math.floor(
    Number(weapon.baseHp || 0) +
    Number(weapon.baseAtk || 0) * 3 +
    Number(weapon.baseSpd || 0)
  );
}

// ===============================
// 基礎神兵修為加成
// ===============================
export function calcWeaponXpBonus(weapon) {
  if (!weapon) return 0;
  return Number(weapon.xpBonus || 0);
}

// ===============================
// 鍛造後神兵戰力
// 規則：每升 1 級，小幅增加戰力
// 這裡先設計成：每級 +3 戰力
// ===============================
export function calcForgedWeaponPower(weapon) {
  if (!weapon) return 0;

  const base = calcWeaponPower(weapon);
  const forgeLevel = Math.max(1, Math.min(30, Number(weapon.forgeLevel || 1)));
  const bonusPower = Number(weapon.bonusPower || 0);

  return base + bonusPower + (forgeLevel - 1) * 3;
}

// ===============================
// 鍛造後神兵修為加成
// 規則：每升 1 級，小幅增加修為
// 這裡先設計成：每級 +1 修為
// ===============================
export function calcForgedWeaponXpBonus(weapon) {
  if (!weapon) return 0;

  const base = calcWeaponXpBonus(weapon);
  const forgeLevel = Math.max(1, Math.min(30, Number(weapon.forgeLevel || 1)));
  const bonusXp = Number(weapon.bonusXp || 0);

  return base + bonusXp + (forgeLevel - 1);
}

// ===============================
// 精煉圖片切換
// 1階: weapon_001.png
// 2階: weapon_001-2.png
// 3階: weapon_001-3.png
// ===============================
export function getWeaponIconByStage(weaponId, refineStage = 1) {
  const safeStage = Math.max(1, Math.min(3, Number(refineStage || 1)));

  if (safeStage === 1) {
    return `/merchandise/${weaponId}.png`;
  }
  return `/merchandise/${weaponId}-${safeStage}.png`;
}

// ===============================
// 精煉後戰力倍率
// 1階 = 1.00
// 2階 = 1.15
// 3階 = 1.30
// ===============================
export function getRefinePowerMultiplier(refineStage = 1) {
  const safeStage = Math.max(1, Math.min(3, Number(refineStage || 1)));

  if (safeStage === 2) return 1.15;
  if (safeStage === 3) return 1.3;
  return 1;
}

// ===============================
// 精煉後修為倍率
// 1階 = 1.00
// 2階 = 1.15
// 3階 = 1.30
// ===============================
export function getRefineXpMultiplier(refineStage = 1) {
  const safeStage = Math.max(1, Math.min(3, Number(refineStage || 1)));

  if (safeStage === 2) return 1.15;
  if (safeStage === 3) return 1.3;
  return 1;
}

// ===============================
// 計算神兵最終戰力（含鍛造 + 精煉）
// ===============================
export function calcFinalWeaponPower(weapon) {
  if (!weapon) return 0;

  const forged = calcForgedWeaponPower(weapon);
  const refineMul = getRefinePowerMultiplier(weapon.refineStage || 1);

  return Math.floor(forged * refineMul);
}

// ===============================
// 計算神兵最終修為（含鍛造 + 精煉）
// ===============================
export function calcFinalWeaponXpBonus(weapon) {
  if (!weapon) return 0;

  const forgedXp = calcForgedWeaponXpBonus(weapon);
  const refineMul = getRefineXpMultiplier(weapon.refineStage || 1);

  return Math.floor(forgedXp * refineMul);
}

// ===============================
// 建立神兵 inventory 文件
// ===============================
export function createWeaponInventoryDoc(master) {
  return {
    itemId: master.id,
    name: master.name,
    category: "weapon",
    itemType: "weapon",
    icon: master.icon,
    requiredLevel: Number(master.requiredLevel || 1),

    baseHp: Number(master.baseHp || 0),
    baseAtk: Number(master.baseAtk || 0),
    baseSpd: Number(master.baseSpd || 0),
    xpBonus: Number(master.xpBonus || 0),

    skillName: master.skillName || "",
    skillDesc: master.skillDesc || "",
    desc: master.desc || "",

    equipped: false,
    qty: 1,

    // ===== 神兵進階欄位 =====
    forgeLevel: 1,
    refineStage: 1,
    bonusPower: 0,
    bonusXp: 0,
    extraEffects: [],
  };
}

// ===============================
// 特效品質順序
// 白 < 藍 < 紫 < 紅 < 金
// ===============================
export const EFFECT_QUALITY_ORDER = {
  white: 1,
  blue: 2,
  purple: 3,
  red: 4,
  gold: 5,
};

// ===============================
// 特效品質中文
// ===============================
export const EFFECT_QUALITY_LABEL = {
  white: "白",
  blue: "藍",
  purple: "紫",
  red: "紅",
  gold: "金",
};

// ===============================
// 特效類型中文
// ===============================
export const EFFECT_TYPE_LABEL = {
  cultivation_boost: "修為收益加成",
  xp_boost: "經驗收益加成",
  coin_boost: "妖丹收益加成",
  power_boost: "戰力收益加成",
  drop_boost: "掉寶收益加成",
};

// ===============================
// 品質對應數值範圍
// 你之後可再調整
// ===============================
export function getEffectValueByQuality(quality) {
  switch (quality) {
    case "blue":
      return 5;
    case "purple":
      return 8;
    case "red":
      return 12;
    case "gold":
      return 16;
    case "white":
    default:
      return 3;
  }
}

// ===============================
// 隨機品質
// 權重：白45 藍28 紫16 紅8 金3
// ===============================
export function rollEffectQuality() {
  const r = Math.random() * 100;

  if (r < 45) return "white";
  if (r < 73) return "blue";
  if (r < 89) return "purple";
  if (r < 97) return "red";
  return "gold";
}

// ===============================
// 隨機特效類型
// ===============================
export function rollEffectType() {
  const pool = [
    "cultivation_boost",
    "xp_boost",
    "coin_boost",
    "power_boost",
    "drop_boost",
  ];

  return pool[Math.floor(Math.random() * pool.length)];
}

// ===============================
// 產生一條新特效
// ===============================
export function rollWeaponEffect() {
  const quality = rollEffectQuality();
  const effectType = rollEffectType();
  const value = getEffectValueByQuality(quality);

  return {
    quality,
    effectType,
    value,
  };
}

// ===============================
// 品質比較
// 回傳 true 表示 a 比 b 好
// ===============================
export function isEffectQualityBetter(a, b) {
  const rankA = EFFECT_QUALITY_ORDER[a?.quality] || 0;
  const rankB = EFFECT_QUALITY_ORDER[b?.quality] || 0;
  return rankA > rankB;
}

// ===============================
// 加入 / 洗練特效
// 規則：最多 2 條，自動刪低品質保留高品質
// ===============================
export function mergeWeaponEffects(oldEffects = [], newEffect) {
  const safeOld = Array.isArray(oldEffects) ? [...oldEffects] : [];

  if (!newEffect) return safeOld;

  // 少於 2 條，直接加
  if (safeOld.length < 2) {
    return [...safeOld, newEffect];
  }

  // 已滿 2 條，找最低品質那條
  let sorted = [...safeOld].sort((a, b) => {
    const rankA = EFFECT_QUALITY_ORDER[a?.quality] || 0;
    const rankB = EFFECT_QUALITY_ORDER[b?.quality] || 0;
    return rankA - rankB;
  });

  const weakest = sorted[0];
  const remain = sorted.slice(1);

  if (isEffectQualityBetter(newEffect, weakest)) {
    return [...remain, newEffect];
  }

  return safeOld;
}

// ===============================
// 從一把武器取出特效清單
// ===============================
export function getWeaponEffects(weapon) {
  return Array.isArray(weapon?.extraEffects) ? weapon.extraEffects : [];
}

// ===============================
// 取出某一把武器某種特效的總和
// effectType:
// cultivation_boost / xp_boost / coin_boost / power_boost / drop_boost
// ===============================
export function getWeaponEffectValue(weapon, effectType) {
  const effects = getWeaponEffects(weapon);
  return effects.reduce((sum, ef) => {
    if (ef?.effectType === effectType) {
      return sum + Number(ef?.value || 0);
    }
    return sum;
  }, 0);
}

// ===============================
// 取出多把武器某種特效的總和
// ===============================
export function getEquippedWeaponsEffectTotal(weapons = [], effectType) {
  const safeWeapons = Array.isArray(weapons) ? weapons : [];
  return safeWeapons.reduce((sum, w) => {
    return sum + getWeaponEffectValue(w, effectType);
  }, 0);
}

// ===============================
// 計算特效加成後的戰力額外值
// 規則：以「弟子+靈寵+神兵原本總戰力」作為基底
// power_boost 例：+8 => 額外增加 8%
// ===============================
export function calcPowerBoostExtra(baseTotalPower, weapons = []) {
  const boostPercent = getEquippedWeaponsEffectTotal(weapons, "power_boost");
  return Math.floor(Number(baseTotalPower || 0) * (boostPercent / 100));
}

// ===============================
// 計算特效加成後的修為額外值
// cultivation_boost 例：+8 => 額外增加 8%
// ===============================
export function calcCultivationBoostExtra(baseCultivation, weapons = []) {
  const boostPercent = getEquippedWeaponsEffectTotal(weapons, "cultivation_boost");
  return Math.floor(Number(baseCultivation || 0) * (boostPercent / 100));
}

// ===============================
// 計算特效加成後的經驗額外值
// xp_boost 例：+8 => 額外增加 8%
// ===============================
export function calcXpBoostExtra(baseXpReward, weapons = []) {
  const boostPercent = getEquippedWeaponsEffectTotal(weapons, "xp_boost");
  return Math.floor(Number(baseXpReward || 0) * (boostPercent / 100));
}

// ===============================
// 計算特效加成後的妖丹額外值
// coin_boost 例：+8 => 額外增加 8%
// ===============================
export function calcCoinBoostExtra(baseCoinReward, weapons = []) {
  const boostPercent = getEquippedWeaponsEffectTotal(weapons, "coin_boost");
  return Math.floor(Number(baseCoinReward || 0) * (boostPercent / 100));
}

// ===============================
// 直接取掉寶收益加成總百分比
// drop_boost 例：+8 => 掉率額外 +8%
// ===============================
export function getDropBoostPercent(weapons = []) {
  return getEquippedWeaponsEffectTotal(weapons, "drop_boost");
}

// ===============================
// 將已裝備武器的特效整理成人看得懂的摘要
// ===============================
export function getEquippedWeaponEffectSummary(weapons = []) {
  const safeWeapons = Array.isArray(weapons) ? weapons : [];

  return {
    cultivation_boost: getEquippedWeaponsEffectTotal(safeWeapons, "cultivation_boost"),
    xp_boost: getEquippedWeaponsEffectTotal(safeWeapons, "xp_boost"),
    coin_boost: getEquippedWeaponsEffectTotal(safeWeapons, "coin_boost"),
    power_boost: getEquippedWeaponsEffectTotal(safeWeapons, "power_boost"),
    drop_boost: getEquippedWeaponsEffectTotal(safeWeapons, "drop_boost"),
  };
}
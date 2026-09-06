export const MAX_STUDENT_LEVEL = 99;
export const XP_PER_LEVEL = 100;

// 0~99 XP => Lv1, 100~199 XP => Lv2 ...
export function calcLevelFromXp(xp) {
  const safeXp = Math.max(0, Number(xp || 0));
  return Math.min(MAX_STUDENT_LEVEL, Math.floor(safeXp / XP_PER_LEVEL) + 1);
}

// 核心總戰力：基礎戰力 + 目前靈寵戰力 + 目前神兵戰力。
// 加成系統暫時不納入計算。
export function calcStudentTotalPower(student) {
  return (
    Number(student?.cp || 0) +
    Number(student?.currentPetPower || 0) +
    Number(student?.currentWeaponPower || 0)
  );
}

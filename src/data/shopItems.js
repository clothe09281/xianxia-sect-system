export const SHOP_ITEMS = [
  // =========================
  // 🐾 靈寵本體
  // 購買後：直接進 pets 子集合
  // 若已擁有同隻：可在 StudentPage 改成轉為碎片或其他補償
  // =========================
  {
    id: "pet_001",
    tab: "pet",
    itemType: "pet",
    name: "青靈幼狐",
    desc: "靈狐一脈，擅長守護與妖丹加成。",
    price: 1000,
    icon: "/merchandise/pet_001.png",
    badge: "靈寵",
  },
  {
    id: "pet_002",
    tab: "pet",
    itemType: "pet",
    name: "天眼神鷹",
    desc: "擁有銳利靈視，擅長戰力與速度成長。",
    price: 1000,
    icon: "/merchandise/pet_002.png",
    badge: "靈寵",
  },
  {
    id: "pet_003",
    tab: "pet",
    itemType: "pet",
    name: "太虛白澤",
    desc: "祥瑞靈獸，擅長恢復與穩定成長。",
    price: 1000,
    icon: "/merchandise/pet_003.png",
    badge: "靈寵",
  },

  // =========================
  // 🧩 通用靈寵碎片
  // 購買後：不進背包，直接加到 student.petShard
  // 所有靈寵升星都能用
  // =========================
  {
    id: "pet_piece",
    tab: "pet",
    itemType: "pet_shard",
    name: "靈寵碎片",
    desc: "所有靈寵升星皆可使用的通用碎片。",
    price: 120,
    icon: "/merchandise/piece.png",
    badge: "通用素材",
  },

  // =========================
  // 🌿 天地靈寶
  // 用於孵化餵養、靈寵升級
  // 進 inventory
  // =========================
  {
    id: "mat_lingbao_001",
    tab: "pet",
    itemType: "material",
    name: "天地靈寶",
    desc: "用於孵化靈獸與靈寵升級。",
    price: 200,
    icon: "/merchandise/mat_lingbao_001.png",
    badge: "素材",
  },
  {
    id: "mat_lingbao_002",
    tab: "pet",
    itemType: "material",
    name: "天地靈寶",
    desc: "用於孵化靈獸與靈寵升級。",
    price: 200,
    icon: "/merchandise/mat_lingbao_002.png",
    badge: "素材",
  },
  {
    id: "mat_lingbao_003",
    tab: "pet",
    itemType: "material",
    name: "天地靈寶",
    desc: "用於孵化靈獸與靈寵升級。",
    price: 200,
    icon: "/merchandise/mat_lingbao_003.png",
    badge: "素材",
  },

  // =========================
  // ⚔️ 神兵
  // 購買後：進 inventory
  // =========================
  {
    id: "weapon_001",
    tab: "weapon",
    itemType: "weapon",
    name: "青雲短刃",
    desc: "輕靈迅捷，適合敏捷型修士。",
    price: 320,
    icon: "/merchandise/weapon_001.png",
    badge: "神兵",
  },
  {
    id: "weapon_002",
    tab: "weapon",
    itemType: "weapon",
    name: "破曉長弓",
    desc: "遠距神兵，擅長持續輸出。",
    price: 360,
    icon: "/merchandise/weapon_002.png",
    badge: "神兵",
  },
  {
    id: "weapon_003",
    tab: "weapon",
    itemType: "weapon",
    name: "玄影雙刃",
    desc: "雙刃齊出，近戰爆發強勢。",
    price: 340,
    icon: "/merchandise/weapon_003.png",
    badge: "神兵",
  },

// =========================
  // 🎫 特權卡
  // 購買後：進 inventory / card
  // =========================
  {
    id: "card_001",
    tab: "privilege",
    itemType: "card",
    name: "減字訣",
    desc: "作業少寫一遍。",
    price: 700,
    icon: "/merchandise/card_item_001.png",
    badge: "特權",
  },
  {
    id: "card_002",
    tab: "privilege",
    itemType: "card",
    name: "雲影步",
    desc: "一次小遲到紀錄不列入。",
    price: 700,
    icon: "/merchandise/card_item_002.png",
    badge: "特權",
  },
  {
    id: "card_003",
    tab: "privilege",
    itemType: "card",
    name: "緩衝符",
    desc: "一次作業／報告可緩衝繳交。",
    price: 700,
    icon: "/merchandise/card_item_003.png",
    badge: "特權",
  },
  { id: "card_004", tab: "privilege", name: "逍遙午休", desc: "午休可以選擇安靜做自己的事", price: 700, icon: "/merchandise/card_item_004.png" },
  { id: "card_005", tab: "privilege", name: "靈光護體", desc: "一次上課發言錯誤不扣分／不記提醒", price: 700, icon: "/merchandise/card_item_005.png" },
  { id: "card_006", tab: "privilege", name: "丹田補氣", desc: "獲得一次「小餅乾或運動飲料補氣」", price: 700, icon: "/merchandise/card_item_006.png" },
  { id: "card_007", tab: "privilege", name: "妖丹進階", desc: "骰骰子數字*20倍妖丹", price: 250, icon: "/merchandise/card_item_007.png" },
  { id: "card_008", tab: "privilege", name: "移形換位", desc: "優先選座位", price: 800, icon: "/merchandise/card_item_008.png" },
  { id: "card_009", tab: "privilege", name: "流光瞬移", desc: "一次優先選擇小組／活動順序", price: 800, icon: "/merchandise/card_item_009.png" },
  { id: "card_010", tab: "privilege", name: "天選福袋", desc: "禮物池自選一樣", price: 800, icon: "/merchandise/card_item_010.png" },
  { id: "card_011", tab: "privilege", name: "天機一問", desc: "小考可向老師請求一次「提示指引」", price: 900, icon: "/merchandise/card_item_011.png" },
  { id: "card_012", tab: "privilege", name: "祕寶禮盒", desc: "師尊特製小禮物（限量）", price: 950, icon: "/merchandise/card_item_012.png" },  
];

// ====== 圖片 import（只在這裡寫一次） ======
import pet_001Img from "../assets/merchandise/pet_001.png";
import pet_002Img from "../assets/merchandise/pet_002.png";
import pet_003Img from "../assets/merchandise/pet_003.png";


import weapon_001Img from "../assets/merchandise/weapon_001.png";
import weapon_002Img from "../assets/merchandise/weapon_002.png";
import weapon_003Img from "../assets/merchandise/weapon_003.png";

import card_001Img from "../assets/merchandise/card_item_001.png";
import card_002Img from "../assets/merchandise/card_item_002.png";
import card_003Img from "../assets/merchandise/card_item_003.png";
import card_004Img from "../assets/merchandise/card_item_004.png";
import card_005Img from "../assets/merchandise/card_item_005.png";
import card_006Img from "../assets/merchandise/card_item_006.png";
import card_007Img from "../assets/merchandise/card_item_007.png";
import card_008Img from "../assets/merchandise/card_item_008.png";
import card_009Img from "../assets/merchandise/card_item_009.png";
import card_010Img from "../assets/merchandise/card_item_010.png";
import card_011Img from "../assets/merchandise/card_item_011.png";
import card_012Img from "../assets/merchandise/card_item_012.png";


// ====== 統一商城資料格式 ======
export const SHOP_ITEMS = [
  // 🐾 靈寵
  { id: "pet_001", tab: "pet", name: "青靈幼狐", desc: "增加", price: 100, icon: pet_001Img },
  { id: "pet_002", tab: "pet", name: "天眼神鷹", desc: "增加", price: 100, icon: pet_002Img },
  { id: "pet_003", tab: "pet", name: "太虛白澤", desc: "增加", price: 100, icon: pet_003Img },


// ⚔️ 神兵
  { id: "weapon_001", tab: "weapon", name: "青雲短刃", desc: "攻擊力 +5", price: 60, icon: weapon_001Img },
  { id: "weapon_002", tab: "weapon", name: "破曉長弓", desc: "技能特效", price: 90, icon: weapon_002Img },
  { id: "weapon_003", tab: "weapon", name: "玄影雙刃", desc: "回復效果", price: 70, icon: weapon_003Img },


// 🎫 特權卡
  { id: "card_001", tab: "privilege", name: "減字訣", desc: "作業少寫一遍", price: 250, icon: card_001Img },
  { id: "card_002", tab: "privilege", name: "雲影步", desc: "一次小遲到紀錄不列入", price: 250, icon: card_002Img },
  { id: "card_003", tab: "privilege", name: "緩衝符", desc: "一次作業/報告可緩衝繳交", price: 250, icon: card_003Img },
  { id: "card_004", tab: "privilege", name: "逍遙午休", desc: "午休可以選擇安靜做自己的事", price: 250, icon: card_004Img },
  { id: "card_005", tab: "privilege", name: "靈光護體", desc: "一次上課發言錯誤不扣分／不記提醒", price: 250, icon: card_005Img },
  { id: "card_006", tab: "privilege", name: "丹田補氣", desc: "獲得一次「小餅乾或運動飲料補氣」", price: 250, icon: card_006Img },
  { id: "card_007", tab: "privilege", name: "妖丹進階", desc: "骰骰子數字*10倍妖丹", price: 250, icon: card_007Img },
  { id: "card_008", tab: "privilege", name: "移形換位", desc: "優先選座位", price: 300, icon: card_008Img },
  { id: "card_009", tab: "privilege", name: "流光瞬移", desc: "一次優先選擇小組／活動順序", price: 300, icon: card_009Img },
  { id: "card_010", tab: "privilege", name: "天選福袋", desc: "禮物池自選一樣", price: 300, icon: card_010Img },
  { id: "card_011", tab: "privilege", name: "天機一問", desc: "小考可向老師請求一次「提示指引」", price: 350, icon: card_011Img },
  { id: "card_012", tab: "privilege", name: "祕寶禮盒", desc: "師尊特製小禮物（限量）", price: 350, icon: card_012Img },  
];

"use strict";

const VEHICLES = [
  ["Toyota", "Land Cruser", 170000],
  ["Kia", "K5", 120000],
  ["Hyundai", "Sonata", 140000],
  ["Volkswagen", "Tiguan", 150000],
  ["Toyota", "Camry", 160000],
  ["BMW", "3 Series", 200000],
  ["Mercedes-Benz", "C-Class", 200000],
  ["Audi", "A6", 200000],
  ["BMW", "5 Series", 250000],
  ["Mercedes-Benz", "E-Class", 250000],
  ["Audi", "Q5", 250000],
  ["BMW", "X5M", 300000],
  ["Mercedes-Benz", "GLE", 300000],
  ["Land Rover", "Range Rover Sport", 300000],
  ["Porsche", "Cayenne 2024", 300000],
  ["BMW", "X7", 350000],
  ["Mercedes-Benz", "S-Class", 350000],
  ["Mercedes-Benz", "G-Class", 350000],
  ["Porsche", "911 Carrera", 350000],
  ["BMW", "M5 F90", 350000]
].map(([brand, model, price], i) => ({
  id: `hm_${i + 1}`,
  brand,
  model,
  price,
  category: "Heavy Motors"
}));

const EXCLUSIVE = [
  ["Mercedes-Benz", "S 580", 320000, "AMG"],
  ["BMW", "M8 Competition", 340000, "Motorsport"],
  ["Audi", "RS Q8 ", 330000, "CARBONE"],
  ["Porsche", "911 Turbo S Mansory", 430000, "MANSORY"],
  ["BMW", "X7 M60i Mansory", 480000, "MANSORY"],
  ["Mercedes-Benz", "G 63 BRABUS", 520000, "BRABUS"],
  ["Mercedes-Benz", "S 580 BRABUS", 500000, "BRABUS"],
  ["Porsche", "Cayenne Turbo GT", 460000, "stock"],
  ["Audi", "RS 7 Full-Carbone", 390000, "CARBONE"],
  ["BMW", "XM Label Alpina", 410000, "ALPINA"],
  ["Mercedes-Benz", "Maybach S 680", 560000, "AMG"],
  ["Porsche", "911 GT3 RS", 590000, "stock"],
  ["Mercedes-Benz", "220 TechArt", 720000, "TechArt"],
  ["Ferrari", "296 GTB", 760000],
  ["Lamborghini", "Huracan Tecnica Novitec", 780000, "NOVITEC"]
].map(([brand, model, price, tuning], i) => ({
  id: `he_${i + 1}`,
  brand,
  model,
  price,
  tuning,
  category: "Heavy Exclusive"
}));

const PROPERTY = [
  ["lux_apartment", "Lux Apartment", "Lux", 90000],
  ["lux_cottage", "Lux Cottage", "Lux", 125000],
  ["lux_residence", "Lux Residence", "Lux", 170000],
  ["absolute_house", "Absolute House", "Absolute", 240000],
  ["absolute_penthouse", "Absolute Penthouse", "Absolute", 320000],
  ["absolute_sea", "Penthouse у моря", "Absolute", 390000],
  ["legend_mansion", "Загородный дом", "Legend", 520000],
  ["legend_estate", "Legend Estate", "Legend", 680000],
  ["legend_palace", "Пентхаус", "Legend", 850000],
  ["brutal_residence", "Особняк", "Brutal", 1100000],
  ["brutal_villa", "Вилла", "Brutal", 1450000],
  ["brutal_palace", "Дворец", "Brutal", 1900000]
].map(([id, name, tier, price]) => ({
  id,
  name,
  tier,
  price
}));

const PROPERTY_COLORS = Object.freeze({
  Lux: "#6e9cff",
  Absolute: "#c7a1ff",
  Legend: "#e8bd62",
  Brutal: "#ff6b62"
});

const BUSINESSES = [
  ["restaurant", "Ресторан", 180000],
  ["nightclub", "Ночной клуб", 260000],
  ["hotel", "Отель", 420000],
  ["factory", "Фабрика", 650000],
  ["oil_terminal", "Нефтяной терминал", 1100000]
].map(([id, name, price]) => ({
  id,
  name,
  price,
  maxOwned: 3
}));

const PLATE_LETTERS = "АВЕКМНОРСТУХ";

const REGIONS = [77, 97, 99, 177, 197, 199];

const BEAUTIFUL_NUMBERS = [
  "А222АА77",
  "А333АА77",
  "А444АА77",
  "А555АА77",
  "А666АА77",
  "А888АА77",
  "А999АА77",
  "У111УУ77",
  "У222УУ77",
  "У333УУ77",
  "У444УУ77",
  "У555УУ77",
  "У666УУ77",
  "У777УУ77",
  "У888УУ77",
  "У999УУ77",
  "Е111ЕЕ77",
  "Е777ЕЕ77",
  "М111ММ77",
  "М777ММ77",
  "Х111ХХ77",
  "Х777ХХ77",
  "О777ОО77",
  "К777КК77",
  "Т777ТТ77",
  "С777СС77",
  "В777ВВ77",
  "Р777РР77"
].map((plate, i) => ({
  id: `beautiful_${i + 1}`,
  plate,
  price: 35000 + i * 7500,
  status: "available",
  beautiful: true
}));

function generateNormalPlates(count = 12000) {
  const result = [];
  let n = 0;

  for (const region of REGIONS) {
    for (
      let number = 1;
      number <= 999 && result.length < count;
      number++
    ) {
      const digits = String(number).padStart(3, "0");

      const a =
        PLATE_LETTERS[(number + region) % PLATE_LETTERS.length];

      const b =
        PLATE_LETTERS[(number * 3 + region) % PLATE_LETTERS.length];

      const c =
        PLATE_LETTERS[(number * 7 + region) % PLATE_LETTERS.length];

      const plate = `${a}${digits}${b}${c}${region}`;

      result.push({
        id: `plate_${++n}`,
        plate,
        price: 1200 + (number % 40) * 75,
        status: "available",
        beautiful: false
      });
    }
  }

  return result;
}

const NORMAL_PLATES = generateNormalPlates();

const QUICK_PHRASES = Object.freeze([
  "Спасибо за игру!",
  "Хорошей игры!",
  "Охх…",
  "Скорее!"
]);

const STAKES = Object.freeze([
  100,
  250,
  500,
  1000,
  2500,
  5000,
  10000
]);

const RANKS = Object.freeze([
  { min: 0, name: "Новичок", icon: "I" },
  { min: 900, name: "Игрок", icon: "II" },
  { min: 1000, name: "Картёжник", icon: "III" },
  { min: 1150, name: "Опытный", icon: "IV" },
  { min: 1350, name: "Авторитет", icon: "V" },
  { min: 1600, name: "Тяжеловес", icon: "VI" },
  { min: 1900, name: "Легенда", icon: "VII" }
]);

function rankForRating(rating) {
  let current = RANKS[0];

  for (const rank of RANKS) {
    if (rating >= rank.min) {
      current = rank;
    }
  }

  return current;
}

function getPlateById(id) {
  return (
    NORMAL_PLATES.find(x => x.id === id) ||
    BEAUTIFUL_NUMBERS.find(x => x.id === id) ||
    null
  );
}

module.exports = {
  VEHICLES,
  EXCLUSIVE,
  PROPERTY,
  PROPERTY_COLORS,
  BUSINESSES,
  NORMAL_PLATES,
  BEAUTIFUL_NUMBERS,
  QUICK_PHRASES,
  STAKES,
  RANKS,
  rankForRating,
  getPlateById
};

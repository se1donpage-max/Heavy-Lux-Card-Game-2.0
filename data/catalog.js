"use strict";

const VEHICLES = [
  ["Toyota", "Camry", 52000], ["Kia", "K5", 43000], ["Hyundai", "Sonata", 40000], ["Volkswagen", "Tiguan", 48000], ["Skoda", "Kodiaq", 50000],
  ["BMW", "3 Series", 65000], ["Mercedes-Benz", "C-Class", 70000], ["Audi", "A4", 68000], ["BMW", "5 Series", 95000], ["Mercedes-Benz", "E-Class", 105000],
  ["Audi", "Q5", 98000], ["BMW", "X5", 125000], ["Mercedes-Benz", "GLE", 132000], ["Land Rover", "Range Rover Sport", 175000], ["Porsche", "Cayenne", 165000],
  ["BMW", "X7", 185000], ["Mercedes-Benz", "S-Class", 220000], ["Mercedes-Benz", "G-Class", 260000], ["Porsche", "911 Carrera", 240000], ["BMW", "M5", 190000]
].map(([brand, model, price], i) => ({ id: `hm_${i + 1}`, brand, model, price, category: "Heavy Motors" }));

const EXCLUSIVE = [
  ["Mercedes-Benz", "S 580", 320000, "stock"], ["BMW", "M8 Competition", 340000, "stock"], ["Audi", "RS Q8 ", 330000, "stock"], ["Porsche", "911 Turbo S", 430000, "stock"],
  ["BMW", "X7 M60i MANSORY", 480000, "MANSORY"], ["Mercedes-Benz", "G 63 BRABUS", 520000, "BRABUS"], ["Mercedes-Benz", "S 580 BRABUS", 500000, "BRABUS"],
  ["Porsche", "Cayenne Turbo GT", 460000, "stock"], ["Audi", "RS 7 Full-Carbone", 390000, "stock"], ["BMW", "XM Label Alpina", 410000, "stock"], ["Mercedes-Benz", "Maybach S 680", 560000, "stock"],
  ["Porsche", "911 GT3 RS", 590000, "stock"], ["Mercedes-Benz", "220 TechArt", 720000, "TechArt"], ["Ferrari", "296 GTB", 760000, "stock"], ["Lamborghini", "Huracan Tecnica Novitec", 780000, "Novitec"]
].map(([brand, model, price, tuning], i) => ({ id: `he_${i + 1}`, brand, model, price, tuning, category: "Heavy Exclusive" }));

const PROPERTY = [
  ["lux_apartment", "Lux Apartment", "Lux", 90000], ["lux_cottage", "Lux Cottage", "Lux", 125000], ["lux_residence", "Lux Residence", "Lux", 170000], ["absolute_house", "Absolute House", "Absolute", 240000],
  ["absolute_penthouse", "Absolute Penthouse", "Absolute", 320000], ["absolute_sea", "Penthouse у моря", "Absolute", 390000], ["legend_mansion", "Legend Mansion", "Legend", 520000],
  ["legend_estate", "Legend Estate", "Legend", 680000], ["legend_palace", "Legend Palace", "Legend", 850000], ["brutal_residence", "Brutal Residence", "Brutal", 1100000],
  ["brutal_villa", "Brutal Villa", "Brutal", 1450000], ["brutal_palace", "Brutal Palace", "Brutal", 1900000]
].map(([id, name, tier, price]) => ({ id, name, tier, price }));

const PROPERTY_COLORS = Object.freeze({ Lux: "#6e9cff", Absolute: "#c7a1ff", Legend: "#e8bd62", Brutal: "#ff6b62" });

const BUSINESSES = [
  ["restaurant", "Ресторан", 180000], ["nightclub", "Ночной клуб", 260000], ["hotel", "Отель", 420000], ["factory", "Фабрика", 650000], ["oil_terminal", "Нефтяной терминал", 1100000]
].map(([id, name, price]) => ({ id, name, price, maxOwned: 3 }));

const PLATE_LETTERS = "АВЕКМНОРСТУХ";
const REGIONS = [77, 97, 99, 177, 197, 199];
const BEAUTIFUL_NUMBERS = [
  "А111АА77","А222АА77","А333АА77","А444АА77","А555АА77","А666АА77","А777АА77","А888АА77","А999АА77","У111УУ77",
  "У222УУ77","У333УУ77","У444УУ77","У555УУ77","У666УУ77","У777УУ77","У888УУ77","У999УУ77","Е111ЕЕ77","Е777ЕЕ77",
  "М111ММ77","М777ММ77","Х111ХХ77","Х777ХХ77","О777ОО77","К777КК77","Т777ТТ77","С777СС77","В777ВВ77","Р777РР77"
].map((plate, i) => ({ id: `beautiful_${i + 1}`, plate, price: 35000 + i * 7500, status: "available", beautiful: true }));

function generateNormalPlates(count = 12000) {
  const result = [];
  let n = 0;
  for (const region of REGIONS) {
    for (let number = 1; number <= 999 && result.length < count; number++) {
      const digits = String(number).padStart(3, "0");
      const a = PLATE_LETTERS[(number + region) % PLATE_LETTERS.length];
      const b = PLATE_LETTERS[(number * 3 + region) % PLATE_LETTERS.length];
      const c = PLATE_LETTERS[(number * 7 + region) % PLATE_LETTERS.length];
      const plate = `${a}${digits}${b}${c}${region}`;
      result.push({ id: `plate_${++n}`, plate, price: 1200 + (number % 40) * 75, status: "available", beautiful: false });
    }
  }
  return result;
}

const NORMAL_PLATES = generateNormalPlates();
const QUICK_PHRASES = Object.freeze(["Спасибо за игру!", "Хорошей игры!", "Охх…", "Скорее!"]);
const STAKES = Object.freeze([100, 250, 500, 1000, 2500, 5000, 10000]);
const RANKS = Object.freeze([
  { min: 0, name: "Новичок", icon: "I" }, { min: 900, name: "Игрок", icon: "II" }, { min: 1000, name: "Картёжник", icon: "III" },
  { min: 1150, name: "Опытный", icon: "IV" }, { min: 1350, name: "Авторитет", icon: "V" }, { min: 1600, name: "Тяжеловес", icon: "VI" }, { min: 1900, name: "Легенда", icon: "VII" }
]);

function rankForRating(rating) { let current = RANKS[0]; for (const rank of RANKS) if (rating >= rank.min) current = rank; return current; }
function getPlateById(id) { return NORMAL_PLATES.find(x => x.id === id) || BEAUTIFUL_NUMBERS.find(x => x.id === id) || null; }

module.exports = { VEHICLES, EXCLUSIVE, PROPERTY, PROPERTY_COLORS, BUSINESSES, NORMAL_PLATES, BEAUTIFUL_NUMBERS, QUICK_PHRASES, STAKES, RANKS, rankForRating, getPlateById };

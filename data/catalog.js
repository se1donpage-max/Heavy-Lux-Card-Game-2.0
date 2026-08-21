"use strict";

/*
=========================================================
HEAVY LUX CARD
CATALOG
BASE V3
=========================================================
*/


/*
=========================================================
VEHICLES
=========================================================
*/

const VEHICLES = Object.freeze(
  [
    ["BMW", "3 Series", 65000],
    ["Mercedes-Benz", "C-Class", 70000],
    ["Audi", "A4", 68000],
    ["Toyota", "Camry", 52000],
    ["Kia", "K5", 43000],
    ["Hyundai", "Sonata", 40000],
    ["Volkswagen", "Tiguan", 48000],
    ["Skoda", "Kodiaq", 50000],
    ["Lexus", "ES", 85000],
    ["Volvo", "XC60", 78000],

    ["BMW", "5 Series", 110000],
    ["Mercedes-Benz", "E-Class", 115000],
    ["Audi", "A6", 108000],
    ["Land Rover", "Discovery Sport", 125000],
    ["Genesis", "G80", 120000],
    ["Toyota", "Land Cruiser", 150000],
    ["Porsche", "Macan", 160000],
    ["BMW", "X5", 170000],
    ["Mercedes-Benz", "GLE", 175000],
    ["Audi", "Q8", 180000],
  ].map(([brand, model, price], i) => ({
    id: `motors_${i + 1}`,
    brand,
    model,
    price,
  }))
);


/*
=========================================================
EXCLUSIVE VEHICLES
=========================================================
*/

const EXCLUSIVE = [
  ["BMW", "M5 Competition", 280000, ""],
  ["Mercedes-Benz", "AMG GT 63 S", 320000, ""],
  ["Audi", "RS Q8", 290000, ""],
  ["Porsche", "911 Turbo S", 420000, ""],

  ["BMW", "M8 Competition MANSORY", 430000, "MANSORY"],
  ["Mercedes-Benz", "G 63 BRABUS", 520000, "BRABUS"],
  ["Porsche", "Cayenne Turbo HAMANN", 390000, "HAMANN"],
  ["Audi", "RS7 MANSORY", 410000, "MANSORY"],

  ["Lamborghini", "Huracán", 650000, ""],
  ["Ferrari", "488 GTB", 720000, ""],
  ["McLaren", "720S", 700000, ""],

  ["Porsche", "918 Spyder", 1800000, ""],
  ["Lamborghini", "Revuelto", 1200000, ""],
  ["Ferrari", "SF90 Stradale", 1300000, ""],
  ["McLaren", "750S", 850000, ""],
].map(([brand, model, price, tuning], i) => ({
  id: `exclusive_${i + 1}`,
  brand,
  model,
  price,
  tuning,
}));


/*
=========================================================
PROPERTY
=========================================================
*/

const PROPERTY = [
  ["lux", "Heavy Residence", "45000"],
  ["lux", "Skyline Apartment", "70000"],
  ["lux", "Black House", "95000"],

  ["absolute", "Absolute Penthouse", "160000"],
  ["absolute", "Royal Residence", "220000"],
  ["absolute", "Grand Villa", "300000"],

  ["legend", "Legend Estate", "500000"],
  ["legend", "Imperial Mansion", "750000"],
  ["legend", "Golden Coast Villa", "1000000"],

  ["brutal", "Brutal Palace", "1600000"],
  ["brutal", "Black Crown Estate", "2500000"],
].map(([tier, name, price], i) => ({
  id: `property_${i + 1}`,
  tier,
  name,
  price: Number(price),
}));


/*
=========================================================
PROPERTY COLORS
=========================================================
*/

const PROPERTY_COLORS = Object.freeze({
  lux: "#79a9ff",
  absolute: "#b98cff",
  legend: "#ffd15c",
  brutal: "#ff5f6d",
});


/*
=========================================================
QUICK PHRASES
=========================================================
*/

const QUICK_PHRASES = Object.freeze([
  "Спасибо за игру!",
  "Хорошей игры!",
  "Охх…",
  "Скорее!",
]);


/*
=========================================================
BEAUTIFUL NUMBER PRICE
=========================================================
*/

function numberPrice(value) {
  const digits = value.match(/\d+/)?.[0] || "";
  const letters = value.match(/[А-ЯЁ]/gi)?.[0] || "";

  let score = 1000;

  /*
  Triple identical digits:
  111
  222
  777
  etc.
  */

  if (/([0-9])\1\1/.test(digits)) {
    score += 12000;
  }

  /*
  Special combinations
  */

  if (/777|888|999|001|007/.test(digits)) {
    score += 8000;
  }

  /*
  Triple identical letters
  */

  if (/([А-ЯЁ])\1\1/.test(letters)) {
    score += 10000;
  }

  /*
  Premium first letters
  */

  if (/^[АУЕО]/i.test(value)) {
    score += 1500;
  }

  return score;
}


/*
=========================================================
BEAUTIFUL LICENSE PLATES
=========================================================
*/

const BEAUTIFUL_NUMBERS = [
  "А111АА77",
  "А222АА77",
  "А333АА77",
  "А444АА77",
  "А555АА77",
  "А666АА77",
  "А777АА77",
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
  "Е222ЕЕ77",
  "Е333ЕЕ77",
  "Е444ЕЕ77",
  "Е555ЕЕ77",
  "Е777ЕЕ77",
  "Е888ЕЕ77",
  "Е999ЕЕ77",

  "Х777ХХ77",
  "Х888ХХ77",
  "Х999ХХ77",

  "М777ММ77",
].map((plate, i) => ({
  id: `beautiful_${i + 1}`,
  plate,
  price: numberPrice(plate) + 25000,
}));


/*
=========================================================
EXPORT
=========================================================
*/

module.exports = {
  VEHICLES,
  EXCLUSIVE,
  PROPERTY,
  PROPERTY_COLORS,
  BEAUTIFUL_NUMBERS,
  QUICK_PHRASES,
};

const { MongoClient } = require("mongodb");
const fs = require("fs");
require("dotenv").config();

const uri = process.env.MONGODB_URI;

async function importData() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("greenway");
    const collection = db.collection("carData");

    const rawData = JSON.parse(fs.readFileSync("./cars.json", "utf-8"));

    const dataArray = Array.isArray(rawData)
      ? rawData
      : rawData.records || [];

    await collection.deleteMany({});

    const formatted = dataArray.map(r => ({
      year: r[0],
      make: r[1],
      model: r[2],
      class: r[3],
      engine: r[4],
      cylinders: r[5],
      transmission: r[6],
      fuelType: r[7],
      city: r[8],
      highway: r[9],
      combined: r[10],
      mpg: r[11],
      co2: r[12],
    }));

    await collection.insertMany(formatted);

    console.log("✅ Cars data imported successfully");

  } catch (err) {
    console.log("❌ Error:", err.message);
  } finally {
    await client.close();
  }
}

importData();

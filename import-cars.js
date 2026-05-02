const fs = require('fs');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/greenway";

async function importData() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");
    
    const db = client.db("greenway");
    const collection = db.collection("carData");
    
    // Clear existing data
    await collection.deleteMany({});
    console.log("🗑️ Cleared existing car data");
    
    // Read all JSON files
    const files = [
      { path: 'cars-2015.json', lang: 'en' },
      { path: 'cars-1995.json', lang: 'en' },
      { path: 'cars-2025.json', lang: 'en' },
      { path: 'cars-2026.json', lang: 'fr' }
    ];
    
    let allCars = [];
    
    for (const file of files) {
      if (!fs.existsSync(file.path)) {
        console.log(`⚠️ File not found: ${file.path}`);
        continue;
      }
      
      const data = JSON.parse(fs.readFileSync(file.path, 'utf8'));
      const records = data.records || data;
      const fields = data.fields;
      
      console.log(`📄 Processing ${file.path}: ${records.length} records`);
      
      for (const record of records) {
        let car = {};
        
        if (file.lang === 'fr') {
          // French file
          car.year = record[0];
          car.make = record[1];
          car.model = record[2];
          car.combined = parseFloat(record[10]) || null; // Combinee (L/100 km)
        } else {
          // English files
          car.year = record[0];
          car.make = record[1];
          car.model = record[2];
          car.combined = parseFloat(record[10]) || null; // Combined (L/100 km)
        }
        
        // Only add if combined value is valid and not electric
        if (car.combined && car.combined > 0 && car.combined < 20) {
          allCars.push(car);
        }
      }
    }
    
    // Remove duplicates (same year, make, model)
    const uniqueCars = [];
    const seen = new Set();
    
    for (const car of allCars) {
      const key = `${car.year}-${car.make}-${car.model}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCars.push(car);
      }
    }
    
    console.log(`📊 Total unique cars: ${uniqueCars.length}`);
    
    // Insert into database
    if (uniqueCars.length > 0) {
      const result = await collection.insertMany(uniqueCars);
      console.log(`✅ Inserted ${result.insertedCount} cars`);
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await client.close();
  }
}

importData();
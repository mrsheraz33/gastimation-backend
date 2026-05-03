const express = require("express");
const router = express.Router();
const axios = require("axios");

// 👇 Store cache for multiple cities
const cityCache = new Map();

// ✅ Helper function to extract city from full address
const extractCity = (address) => {
  if (!address) return null;
  
  const parts = address.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    let cityPart = parts[1];
    // Remove province code
    cityPart = cityPart.replace(/\s+(ON|BC|AB|QC|NS|NB|MB|SK|PE|NL|YT|NT|NU)$/i, '');
    // Remove postal code
    cityPart = cityPart.replace(/\s+[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/, '');
    return cityPart;
  }
  
  return parts[0];
};

// ✅ Helper function to extract province from address
const extractProvince = (address) => {
  if (!address) return null;
  
  const provinceMatch = address.match(/\b(ON|BC|AB|QC|NS|NB|MB|SK|PE|NL|YT|NT|NU)\b/i);
  return provinceMatch ? provinceMatch[1].toUpperCase() : null;
};

router.get("/price", async (req, res) => {
  try {
    let { city } = req.query;

    if (!city) {
      return res.json({ success: false, message: "City is required" });
    }

    // ✅ Extract city from full address
    const extractedCity = extractCity(city);
    const province = extractProvince(city);
    
    console.log(`📍 Original: "${city}" → Extracted City: "${extractedCity}", Province: "${province}"`);
    
    let cityKey = extractedCity.toLowerCase().trim();
    let foundPrice = null;
    let matchedLocation = null;
    let sourceType = "api";

    // Check cache first
    const cached = cityCache.get(cityKey);
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
      console.log(`⛽ Cache hit for ${extractedCity}: $${cached.price}`);
      return res.json({
        success: true,
        price: cached.price,
        currency: "CAD",
        unit: "liter",
        source: "cache",
        city: extractedCity,
      });
    }

    // Fetch from API
    const response = await axios.get(
      "https://api.collectapi.com/gasPrice/canada",
      {
        headers: {
          "content-type": "application/json",
          authorization: `apikey ${process.env.GAS_PRICE_API_KEY}`,
        },
      }
    );

    const states = response.data.result;

    // Step 1: Try exact city match
    for (const state of states) {
      for (const c of state.cities) {
        if (c.name.toLowerCase() === cityKey) {
          foundPrice = parseFloat(c.gasoline);
          matchedLocation = c.name;
          break;
        }
      }
      if (foundPrice) break;
    }

    // Step 2: Try partial city match
    if (!foundPrice) {
      for (const state of states) {
        for (const c of state.cities) {
          if (c.name.toLowerCase().includes(cityKey) || cityKey.includes(c.name.toLowerCase())) {
            foundPrice = parseFloat(c.gasoline);
            matchedLocation = c.name;
            break;
          }
        }
        if (foundPrice) break;
      }
    }

    // Step 3: If city not found, use province average
    if (!foundPrice && province) {
      console.log(`📍 City "${extractedCity}" not found, using province "${province}" average`);
      
      for (const state of states) {
        if (state.state.toUpperCase() === province || state.state.toUpperCase().includes(province)) {
          const prices = state.cities.map(c => parseFloat(c.gasoline)).filter(p => !isNaN(p));
          if (prices.length > 0) {
            foundPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            matchedLocation = state.state;
            sourceType = "province_average";
          }
          break;
        }
      }
    }

    // Step 4: Fallback to Ontario average
    if (!foundPrice) {
      console.log(`📍 No price found, using Ontario average`);
      for (const state of states) {
        if (state.state === "Ontario") {
          const prices = state.cities.map(c => parseFloat(c.gasoline)).filter(p => !isNaN(p));
          if (prices.length > 0) {
            foundPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            matchedLocation = "Ontario (average)";
          }
          break;
        }
      }
    }

    const price = foundPrice && !isNaN(foundPrice) ? foundPrice : null;

    if (!price) {
      console.log(`⚠️ No price found for ${extractedCity}`);
      return res.json({
        success: false,
        message: `No gas price found for ${extractedCity}`,
        city: extractedCity,
      });
    }

    // Store in cache
    cityCache.set(cityKey, {
      price: price,
      timestamp: Date.now(),
    });

    console.log(`⛽ Gas Price for ${matchedLocation}: $${price} (${sourceType})`);

    res.json({
      success: true,
      price: price,
      city: matchedLocation || extractedCity,
      requestedCity: extractedCity,
      currency: "CAD",
      unit: "liter",
      source: sourceType,
    });

  } catch (error) {
    console.log("❌ API failed:", error.message);
    
    res.status(503).json({
      success: false,
      error: "Gas price API unavailable",
      message: error.message,
      source: "error"
    });
  }
});

module.exports = router;
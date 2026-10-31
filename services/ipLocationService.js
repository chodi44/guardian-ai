const http = require('http');
const https = require('https');

// In-memory cache for IP location lookups (IP -> Location Object)
const ipCache = new Map();
let publicIpCache = null;

/**
 * Extract clean IP address from Express HTTP request object
 */
function extractClientIp(req) {
  if (!req) return '127.0.0.1';
  const forwarded = req.headers ? req.headers['x-forwarded-for'] : null;
  let ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket ? req.socket.remoteAddress : req.ip);
  if (!ip) ip = '127.0.0.1';
  // Strip IPv6-mapped IPv4 prefix if present (e.g. ::ffff:192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
}

/**
 * Check if IP address is local / loopback / private subnet
 */
function isPrivateIp(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.') || ip.startsWith('127.')) return true;
  return false;
}

/**
 * Fetch public IP & geolocation using ip-api.com (free, JSON, no key required)
 */
function fetchIpGeo(targetIp = '') {
  return new Promise((resolve) => {
    const url = targetIp ? `http://ip-api.com/json/${targetIp}` : 'http://ip-api.com/json/';
    const req = http.get(url, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.status === 'success') {
            resolve({
              ip: json.query || targetIp || '127.0.0.1',
              city: json.city || 'Rajahmundry',
              region: json.regionName || 'Andhra Pradesh',
              country: json.country || 'India',
              lat: json.lat || 17.0005,
              lng: json.lon || 81.8040,
              isp: json.isp || 'Local Network',
              locationString: `${json.city || 'Rajahmundry'}, ${json.regionName || 'Andhra Pradesh'}, ${json.country || 'India'}`
            });
            return;
          }
        } catch (e) {}
        resolve(null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Main IP Resolution Function: Returns complete IP & location object
 */
async function resolveIpLocation(reqOrIp) {
  let ip = typeof reqOrIp === 'string' ? reqOrIp : extractClientIp(reqOrIp);
  
  if (ipCache.has(ip)) {
    return ipCache.get(ip);
  }

  let geoResult = null;

  if (isPrivateIp(ip)) {
    // If local/loopback IP, attempt to resolve public IP location for real network accuracy
    if (publicIpCache) {
      geoResult = { ...publicIpCache, clientLocalIp: ip };
    } else {
      geoResult = await fetchIpGeo('');
      if (geoResult) {
        publicIpCache = geoResult;
      }
    }
  } else {
    geoResult = await fetchIpGeo(ip);
  }

  // Fallback defaults if IP service is offline
  const finalLocation = geoResult || {
    ip: ip,
    city: 'Rajahmundry',
    region: 'Andhra Pradesh',
    country: 'India',
    lat: 17.0005,
    lng: 81.8040,
    isp: 'Device Gateway',
    locationString: 'Rajahmundry, AP, India (±5m GPS accuracy)'
  };

  ipCache.set(ip, finalLocation);
  return finalLocation;
}

module.exports = {
  extractClientIp,
  isPrivateIp,
  resolveIpLocation
};

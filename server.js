/******************************************************************************************
   KEEPING A RECORD - Node.js + Express + SQLite + EJS + Axios (Last.fm)
   "Professional asf, complicated code for the real Apple vibes"
*******************************************************************************************/
const express = require('express');
const path = require('path');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

// ========== CONFIGS & CONSTANTS ==========
const LASTFM_API_KEY = "ad4635b0388599282ec4c0657f86ae76"; // Replace with your real key
const PORT = process.env.PORT || 4242;  // a fancy Apple-like port number

// ========== EXPRESS APP INIT ==========
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files for CSS, images, etc.
app.use(express.static(path.join(__dirname, 'public')));

// Parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ========== CONNECT TO SQLITE DB ==========
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('❌ DB Connection Error:', err);
  } else {
    console.log('✅ Connected to SQLite database: database.db');
  }
});

// Create table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS rated_albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_name TEXT,
    artist TEXT,
    avg_rating REAL,
    track_ratings TEXT,
    date_rated DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ========== ROUTES ========== //
/**
 * (1) HOME PAGE
 *    Renders index.ejs which includes a form to accept artist & album input
 */
app.get('/', (req, res) => {
  res.render('index');
});

/**
 * (2) SEARCH
 *    Grabs artist + album from query, calls Last.fm, renders album page
 */
app.get('/search', async (req, res) => {
  try {
    const artistName = req.query.artist;
    const albumName = req.query.album;

    // If user didn't provide artist or album, redirect to home
    if (!artistName || !albumName) return res.redirect('/');

    // Build Last.fm endpoint
    const endpoint = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artistName)}&album=${encodeURIComponent(albumName)}&format=json`;

    // Call Last.fm
    const response = await axios.get(endpoint);
    const data = response.data;

    // If no album found
    if (!data.album) {
      return res.render('error', { 
        message: 'Album not found on Last.fm. Please try again or check spelling.'
      });
    }

    const album = data.album;
    const artist = album.artist || 'Unknown Artist';
    const title = album.name || 'Untitled';
    const coverImage = (album.image && album.image.length > 0)
      ? album.image[album.image.length - 1]['#text']
      : '';
    const genre = (album.tags && album.tags.tag && album.tags.tag.length > 0)
      ? album.tags.tag[0].name
      : 'Unknown Genre';
    const releaseDate = (album.wiki && album.wiki.published) || 'Unknown Release Date';
    const summary = (album.wiki && album.wiki.summary) || 'No background info.';
    const tracks = (album.tracks && album.tracks.track)
      ? album.tracks.track.map(t => t.name)
      : [];

    // Render album.ejs
    res.render('album', {
      albumName: title,
      artist,
      coverImage,
      genre,
      releaseDate,
      summary,
      tracks
    });

  } catch (err) {
    console.error('🔺 Last.fm Error:', err.message);
    // Render error page with a professional message
    res.render('error', { 
      message: 'Something went wrong while fetching album data from Last.fm.' 
    });
  }
});

/**
 * (3) RATE
 *    Accepts the POST request with track ratings, calculates average,
 *    saves to SQLite, then redirects to feed.
 */
app.post('/rate', (req, res) => {
  const { albumName, artist, tracks } = req.body;
  let trackRatings = [];

  // tracks is an array of track names
  if (tracks) {
    tracks.forEach((track, i) => {
      const ratingInputName = `rating-${i}`;
      const ratingVal = parseFloat(req.body[ratingInputName]) || 0;
      trackRatings.push({ track, rating: ratingVal });
    });
  }

  // Calculate average rating
  const total = trackRatings.reduce((sum, tr) => sum + tr.rating, 0);
  const avg = (trackRatings.length > 0) 
    ? (total / trackRatings.length).toFixed(1) 
    : 0;

  // Insert into DB
  const insertSQL = `
    INSERT INTO rated_albums (album_name, artist, avg_rating, track_ratings)
    VALUES (?, ?, ?, ?)
  `;
  db.run(
    insertSQL, 
    [albumName, artist, avg, JSON.stringify(trackRatings)], 
    function(err) {
      if (err) {
        console.error('❌ Insert Error:', err);
        return res.render('error', { message: 'Failed to save ratings to database.' });
      }
      // success → redirect to feed
      res.redirect('/feed');
    }
  );
});

/**
 * (4) FEED
 *    Shows recently rated albums from the DB
 */
app.get('/feed', (req, res) => {
  const query = `SELECT * FROM rated_albums ORDER BY date_rated DESC`;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('🔺 DB Select Error:', err);
      return res.render('error', { message: 'Could not load feed from database.' });
    }
    // Convert track_ratings from JSON
    rows.forEach(r => {
      r.track_ratings = JSON.parse(r.track_ratings);
    });
    res.render('feed', { albums: rows });
  });
});

// (5) 404 Handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found. The path is invalid.' });
});

// ========== START THE SERVER ==========
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});

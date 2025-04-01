/***** GLOBAL CONSTANTS *****/
const LAST_FM_API_KEY = "YOUR_LASTFM_API_KEY";  // ← Replace with a valid key
const STORAGE_KEY = "keepingARecordRatings";    // localStorage key

/***** MAIN DOM ELEMENTS *****/
const albumInput = document.getElementById("albumInput");
const searchBtn = document.getElementById("searchBtn");
const albumDisplay = document.getElementById("albumDisplay");
const ratedFeed = document.getElementById("ratedFeed");

/***** STARTUP *****/
document.addEventListener("DOMContentLoaded", () => {
  renderRatedFeed();
});

/***** SEARCH FLOW *****/
searchBtn.addEventListener("click", async () => {
  const query = albumInput.value.trim();
  if (!query) return;
  const album = await fetchAlbumData(query);
  renderAlbumDetails(album);
});

/***** FETCH FROM LAST.FM *****/
async function fetchAlbumData(albumName) {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${LAST_FM_API_KEY}&album=${encodeURIComponent(albumName)}&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.album) return null;
    return data.album;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/***** RENDER ALBUM DETAILS & RATINGS FORM *****/
function renderAlbumDetails(album) {
  albumDisplay.innerHTML = "";  // clear previous

  if (!album) {
    albumDisplay.innerHTML = `<p style="color:red;">Album not found.</p>`;
    return;
  }

  // Extract data
  const artist = album.artist || "Unknown Artist";
  const albumName = album.name || "Untitled";
  const coverImage = (album.image && album.image.length > 0)
    ? album.image[album.image.length - 1]["#text"]
    : "";
  const genre = (album.tags && album.tags.tag && album.tags.tag.length > 0)
    ? album.tags.tag[0].name
    : "Unknown Genre";
  const releaseDate = (album.wiki && album.wiki.published) || "Unknown Date";
  const summary = (album.wiki && album.wiki.summary) || "No background info.";
  const tracks = (album.tracks && album.tracks.track)
    ? album.tracks.track.map(t => t.name)
    : [];

  // Create DOM
  const h2 = document.createElement("h2");
  h2.textContent = albumName;

  const h3 = document.createElement("h3");
  h3.textContent = "by " + artist;

  let img = null;
  if (coverImage) {
    img = document.createElement("img");
    img.src = coverImage;
    img.alt = "Album Cover";
  }

  const infoP = document.createElement("p");
  infoP.innerHTML = `<strong>Genre:</strong> ${genre} &nbsp;|&nbsp; <strong>Release Date:</strong> ${releaseDate}`;

  const sumP = document.createElement("p");
  sumP.innerHTML = `<strong>Background:</strong> ${summary}`;

  // Tracklist
  const tracklistDiv = document.createElement("div");
  tracklistDiv.classList.add("tracklist");
  if (tracks.length > 0) {
    const ol = document.createElement("ol");
    tracks.forEach((track, i) => {
      const li = document.createElement("li");
      li.textContent = track;
      ol.appendChild(li);
    });
    tracklistDiv.appendChild(ol);
  } else {
    tracklistDiv.textContent = "No tracks found.";
  }

  // Ratings form
  const formDiv = document.createElement("div");
  formDiv.classList.add("ratings-form");
  if (tracks.length > 0) {
    tracks.forEach((track, i) => {
      const label = document.createElement("label");
      label.innerHTML = `${i + 1}. ${track}
        <input type="number" min="0" max="10" step="0.1" id="rating-${i}" style="margin-left:5px;" />`;
      formDiv.appendChild(label);
    });
  }

  const submitBtn = document.createElement("button");
  submitBtn.textContent = "Submit Ratings";
  submitBtn.addEventListener("click", () => {
    // gather rating inputs
    const trackRatings = [];
    tracks.forEach((track, i) => {
      const val = document.getElementById(`rating-${i}`).value;
      const ratingVal = parseFloat(val) || 0;
      trackRatings.push({ track, rating: ratingVal });
    });

    // Calculate average
    const sum = trackRatings.reduce((acc, r) => acc + r.rating, 0);
    const avg = (trackRatings.length > 0) ? (sum / trackRatings.length).toFixed(1) : 0;

    // Build album rating object
    const newEntry = {
      albumName,
      artist,
      trackRatings,
      avgRating: avg,
      timestamp: Date.now()
    };

    // Save to localStorage
    let allRatings = getAllRatings();
    allRatings.push(newEntry);
    saveAllRatings(allRatings);

    // Re-render feed
    renderRatedFeed();

    alert(`Ratings saved! Avg rating: ${avg}/10`);
  });
  formDiv.appendChild(submitBtn);

  // Append to albumDisplay
  albumDisplay.appendChild(h2);
  albumDisplay.appendChild(h3);
  if (img) albumDisplay.appendChild(img);
  albumDisplay.appendChild(infoP);
  albumDisplay.appendChild(sumP);
  albumDisplay.appendChild(tracklistDiv);
  albumDisplay.appendChild(formDiv);
}

/***** RATINGS FEED *****/
function renderRatedFeed() {
  ratedFeed.innerHTML = "";
  let data = getAllRatings();
  // sort by latest
  data.sort((a, b) => b.timestamp - a.timestamp);

  data.forEach(entry => {
    const card = document.createElement("div");
    card.classList.add("album-card");

    const h4 = document.createElement("h4");
    h4.textContent = entry.albumName;

    const artistP = document.createElement("p");
    artistP.textContent = "by " + entry.artist;

    const avgP = document.createElement("p");
    avgP.textContent = `Avg Rating: ${entry.avgRating}/10`;

    // track ratings
    let tracksStr = "";
    entry.trackRatings.forEach(tr => {
      tracksStr += `${tr.track}: ${tr.rating}/10 | `;
    });
    const trackP = document.createElement("p");
    trackP.textContent = `Tracks: ${tracksStr}`;

    card.appendChild(h4);
    card.appendChild(artistP);
    card.appendChild(avgP);
    card.appendChild(trackP);

    ratedFeed.appendChild(card);
  });
}

/***** LOCALSTORAGE HELPERS *****/
function getAllRatings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveAllRatings(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

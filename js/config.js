/* ==========================================================
   SITE CONFIG: edit this one file to rename the business,
   change contact details, or connect the contact form.
   ========================================================== */
window.SITE_CONFIG = {
  // Placeholder brand name. Change it here and it updates everywhere.
  brandName: "ZC Kugelman Interiors",
  brandShort: "ZC Kugelman",            // shown in the nav logo
  tagline: "Space planning and layouts for Brooklyn homes: the right size for every room, and the right place for everything.",
  location: "Brooklyn, New York",

  // CONTACT
  phone: "(347) 526-7400",               // shown on the site; tap-to-call uses tel:+13475267400
  email: "zckugel@gmail.com",
  instagram: "",                         // e.g. "https://instagram.com/yourhandle" (blank = hidden)

  // CONTACT FORM
  // Option A: paste a Formspree (or similar) endpoint, e.g. "https://formspree.io/f/abcd1234"
  // Option B: leave blank and set a real email above; the form opens the visitor's email app (mailto).
  formEndpoint: "",

  // Per-room "View in 3D" models. The whole-home #tour is separate and stays on.
  // Flip to true only after every room has been inspected and signed off.
  roomViewer: false,

  // COUNTERS ("planning numbers"). These are planning facts/guidelines, not business stats.
  // Swap in real business numbers (projects completed, years, etc.) once you have them.
  counters: [
    { value: 2,  suffix: "",   label: "Separate meat & dairy work zones in every kosher kitchen plan" },
    { value: 42, suffix: "″",  label: "Inches of walkway we aim for behind every dining chair" },
    { value: 20, suffix: "+",  label: "Yom Tov guests a dining room can be planned to seat" },
    { value: 1,  suffix: "",   label: "Measured floor plan before a single wall moves" }
  ]
};

if (window.SITE_CONFIG.roomViewer) document.documentElement.classList.add("room-viewer-on");

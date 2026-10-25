document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if (navToggle) {
  navToggle.addEventListener('click', () => navLinks.classList.toggle('show'));
}
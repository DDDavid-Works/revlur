// Waitlist signup. Set ENDPOINT to a form service URL (Formspree, Basin, Getform, ...) that accepts
// a JSON POST with an "email" field. Left empty, the form says signup isn't connected instead of
// pretending to succeed.
const ENDPOINT = '';

document.querySelectorAll('form[data-waitlist]').forEach((form) => {
  const email = form.querySelector('input[name=email]');
  const btn = form.querySelector('button');
  const msg = form.querySelector('.wl-msg');
  const say = (text, kind) => { msg.textContent = text; msg.className = 'wl-msg' + (kind ? ' ' + kind : ''); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.elements.company.value) return say('Thanks, you are on the list.', 'ok'); // honeypot: bots fill this
    if (!email.checkValidity() || !email.value.trim()) return say('Please enter a valid email address.', 'err');
    if (!ENDPOINT) return say('Signup is not connected yet. Please check back soon.', 'err');
    btn.disabled = true;
    say('Adding you...');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email.value.trim() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      say('Thanks! You are on the list. We will email you at launch.', 'ok');
    } catch {
      say('Something went wrong. Please try again.', 'err');
    } finally {
      btn.disabled = false;
    }
  });
});

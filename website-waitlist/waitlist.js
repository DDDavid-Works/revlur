// Waitlist signup via Web3Forms (https://web3forms.com). The access key is public by design: it can only
// send submissions to the inbox it was created for, and can be limited to this site's domain in the
// Web3Forms dashboard. While ACCESS_KEY is empty the form says signup isn't connected instead of
// pretending to succeed.
const ENDPOINT = 'https://api.web3forms.com/submit';
const ACCESS_KEY = '';

document.querySelectorAll('form[data-waitlist]').forEach((form) => {
  const email = form.querySelector('input[name=email]');
  const btn = form.querySelector('button');
  const msg = form.querySelector('.wl-msg');
  const say = (text, kind) => { msg.textContent = text; msg.className = 'wl-msg' + (kind ? ' ' + kind : ''); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.elements.company.value) return say('Thanks, you are on the list.', 'ok'); // honeypot: bots fill this
    if (!email.checkValidity() || !email.value.trim()) return say('Please enter a valid email address.', 'err');
    if (!ACCESS_KEY) return say('Signup is not connected yet. Please check back soon.', 'err');
    btn.disabled = true;
    say('Adding you...');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: 'New Revlur waitlist signup',
          from_name: 'Revlur waitlist',
          email: email.value.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || String(res.status));
      form.reset();
      say('Thanks! You are on the list. We will email you at launch.', 'ok');
    } catch {
      say('Something went wrong. Please try again.', 'err');
    } finally {
      btn.disabled = false;
    }
  });
});

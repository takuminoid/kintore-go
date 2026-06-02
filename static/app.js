const todayStr = new Date().toISOString().slice(0, 10);
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const MESSAGES_DEFAULT = ['今日も頑張ろう！', '一歩ずつ前へ！', '継続は力なり！', 'やるぞ！'];
const MESSAGES_DONE = ['最高！やったね！', '完璧！続けよう！', 'いい調子！', 'やったー！'];

async function load() {
  const res = await fetch('/api/status');
  render(await res.json());
}

function render(data) {
  // ストリーク & 合計
  animateNumber('streak', data.streak);
  animateNumber('total', data.total);

  // ヒーロー
  const hero = document.getElementById('hero');
  const msg  = document.getElementById('hero-msg');
  const mascot = document.getElementById('hero-mascot');
  if (data.today_done) {
    hero.classList.add('done');
    mascot.textContent = '🎉';
    msg.textContent = pick(MESSAGES_DONE);
  } else {
    hero.classList.remove('done');
    mascot.textContent = '🏋️';
    msg.textContent = pick(MESSAGES_DEFAULT);
  }

  // ボタン
  const btn  = document.getElementById('toggle-btn');
  const text = document.getElementById('btn-text');
  if (data.today_done) {
    btn.classList.add('done');
    text.textContent = '✅ 今日の筋トレ完了！　記録を取り消す';
  } else {
    btn.classList.remove('done');
    text.textContent = '今日の筋トレを記録する 💪';
  }

  renderWeek(new Set(data.month));
  renderCalendar(new Set(data.month));
}

function renderWeek(doneSet) {
  const container = document.getElementById('week-dots');
  container.innerHTML = '';
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const isDone  = doneSet.has(ds);
    const isToday = ds === todayStr;

    const dot = document.createElement('div');
    dot.className = 'week-dot' + (isDone ? ' done' : '') + (isToday ? ' today' : '');

    const label  = document.createElement('div');
    label.className = 'week-dot-label';
    label.textContent = DAY_NAMES[d.getDay()];

    const circle = document.createElement('div');
    circle.className = 'week-dot-circle';
    circle.textContent = isDone ? '✓' : (isToday ? '●' : '');

    dot.append(label, circle);
    container.appendChild(dot);
  }
}

function renderCalendar(doneSet) {
  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();

  document.getElementById('cal-month').textContent =
    `${year}年${month + 1}月`;

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const todayDay     = now.getDate();

  const grid = document.getElementById('calendar');
  grid.innerHTML = '';

  for (let i = 0; i < firstWeekday; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const el = document.createElement('div');
    let cls = 'cal-day';
    if (doneSet.has(ds)) cls += ' has-workout';
    if (d === todayDay)  cls += ' today';
    if (d > todayDay)    cls += ' future';
    el.className = cls;
    el.textContent = d;
    grid.appendChild(el);
  }
}

async function toggle() {
  const btn = document.getElementById('toggle-btn');
  btn.classList.add('pop');
  btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });

  const res  = await fetch('/api/toggle', { method: 'POST' });
  const data = await res.json();

  if (data.today_done) celebrate();
  render(data);
}

// 数字のカウントアップアニメーション
function animateNumber(id, target) {
  const el = document.getElementById(id);
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  const step = target > current ? 1 : -1;
  const steps = Math.abs(target - current);
  const delay = Math.max(20, Math.min(80, 600 / steps));
  let v = current;
  const iv = setInterval(() => {
    v += step;
    el.textContent = v;
    if (v === target) clearInterval(iv);
  }, delay);
}

// コンフェッティ
function celebrate() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#58CC02', '#FF9600', '#1CB0F6', '#FF4B4B', '#CE82FF', '#FFD900'];
  const particles = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: -20,
    r: Math.random() * 7 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: Math.random() * 3 + 2,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
    drift: (Math.random() - 0.5) * 1.5,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5);
      ctx.restore();

      p.y     += p.speed;
      p.x     += p.drift;
      p.angle += p.spin;
      p.speed += 0.05;
    });

    if (++frame < 140) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  draw();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

load();

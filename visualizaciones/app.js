// ========================================
// Sample Blog Data
// ========================================
const posts = [
    {
        slug: "understanding-postgres-indexes",
        title: "Understanding PostgreSQL Indexes",
        subtitle: "A deep dive into B-tree, GiST, and GIN indexes",
        date: "2024-12-20",
        image: "https://i.postimg.cc/DzKh9mMt/descarga2.png"
    },
    {
        slug: "building-realtime-apps",
        title: "Building Realtime Applications with WebSockets",
        subtitle: "From polling to persistent connections",
        date: "2024-12-15",
        image: "https://i.postimg.cc/rmrPM9R8/descarga.png"
    },
    {
        slug: "edge-functions-deep-dive",
        title: "Edge Functions: A Deep Dive",
        subtitle: "Running code at the edge with Deno",
        date: "2024-12-10",
        image: "https://i.postimg.cc/DzKh9mMt/descarga2.png"
    },
    {
        slug: "auth-best-practices",
        title: "Authentication Best Practices in 2024",
        subtitle: "OAuth, PKCE, and session management",
        date: "2024-12-05",
        image: "https://i.postimg.cc/rmrPM9R8/descarga.png"
    },
    {
        slug: "row-level-security",
        title: "Row Level Security Patterns",
        subtitle: "Securing your data at the database layer",
        date: "2024-11-28",
        image: "https://i.postimg.cc/DzKh9mMt/descarga2.png"
    },
    {
        slug: "supabase-storage",
        title: "Supabase Storage: Complete Guide",
        subtitle: "File uploads, transformations, and CDN",
        date: "2024-11-20",
        image: "https://i.postimg.cc/rmrPM9R8/descarga.png"
    },
    {
        slug: "database-migrations",
        title: "Database Migrations Done Right",
        subtitle: "Version control for your schema",
        date: "2024-11-12",
        image: "https://i.postimg.cc/DzKh9mMt/descarga2.png"
    },
    {
        slug: "typescript-generics",
        title: "TypeScript Generics Explained",
        subtitle: "From basics to advanced patterns",
        date: "2024-11-05",
        image: "https://i.postimg.cc/rmrPM9R8/descarga.png"
    },
    {
        slug: "performance-optimization",
        title: "Web Performance Optimization",
        subtitle: "Core Web Vitals and beyond",
        date: "2024-10-28",
        image: "https://i.postimg.cc/DzKh9mMt/descarga2.png"
    },
    {
        slug: "serverless-architecture",
        title: "Serverless Architecture Patterns",
        subtitle: "Building scalable applications without servers",
        date: "2024-10-15",
        image: "https://i.postimg.cc/rmrPM9R8/descarga.png"
    }
];

// ========================================
// Theme Management
// ========================================
const themeToggle = document.getElementById('theme-toggle');
const html = document.documentElement;

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        html.classList.add('dark');
    }
}

function toggleTheme() {
    html.classList.toggle('dark');
    localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
}

themeToggle.addEventListener('click', toggleTheme);
initTheme();

// ========================================
// View Toggle
// ========================================
const btnRolodex = document.getElementById('btn-rolodex');
const btnList = document.getElementById('btn-list');
const rolodexView = document.getElementById('rolodex-view');
const listView = document.getElementById('list-view');

function setView(view) {
    if (view === 'rolodex') {
        btnRolodex.classList.add('active');
        btnList.classList.remove('active');
        rolodexView.classList.remove('hidden');
        listView.classList.add('hidden');
    } else {
        btnList.classList.add('active');
        btnRolodex.classList.remove('active');
        listView.classList.remove('hidden');
        rolodexView.classList.add('hidden');
    }
}

btnRolodex.addEventListener('click', () => setView('rolodex'));
btnList.addEventListener('click', () => setView('list'));

// ========================================
// Rolodex Card Stack
// ========================================
const cardsContainer = document.getElementById('cards-container');
let activeIndex = Math.min(4, Math.floor(posts.length / 3));
let dragProgress = 0;
let scrollAccumulator = 0;
const snapThreshold = 0.25;

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatShortDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

function createCards() {
    cardsContainer.innerHTML = '';

    posts.forEach((post, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.index = index;

        card.innerHTML = `
      <a href="#" class="card-inner" onclick="alert('Navigate to: ${post.slug}'); return false;">
        <div class="card-image">
          ${post.image
                ? `<img src="${post.image}" alt="${post.title}" loading="lazy">`
                : `<div class="card-image-placeholder"><span>📝</span></div>`
            }
        </div>
        <div class="card-content">
          <h2 class="card-title">${post.title}</h2>
          ${post.subtitle ? `<p class="card-subtitle">${post.subtitle}</p>` : ''}
          ${post.date ? `<time class="card-date">${formatDate(post.date)}</time>` : ''}
        </div>
      </a>
    `;

        cardsContainer.appendChild(card);
    });

    updateCards();
}

function updateCards() {
    const cards = document.querySelectorAll('.card');

    cards.forEach((card, index) => {
        const offset = index - activeIndex;
        const absOffset = Math.abs(offset);
        const isActive = index === activeIndex;

        // Base positions
        let translateY = offset * 45;
        let translateZ = -absOffset * 60;
        let rotateX = 0;
        let opacity = Math.max(0.4, 1 - absOffset * 0.08);
        let scale = Math.max(0.7, 1 - absOffset * 0.035);

        // Active card - lift effect during drag
        if (isActive && Math.abs(dragProgress) > 0.05) {
            translateY = translateY - dragProgress * 100;
            translateZ = translateZ + Math.abs(dragProgress) * 40;
            rotateX = -dragProgress * 12;
        }

        card.style.transform = `translateY(${translateY}px) translateZ(${translateZ}px) rotateX(${rotateX}deg) scale(${scale})`;
        card.style.opacity = opacity;
        card.style.zIndex = 100 - Math.round(absOffset * 10);

        if (isActive) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    updateTimeline();
}

// ========================================
// Timeline
// ========================================
const timelineTrack = document.getElementById('timeline-track');

function createTimeline() {
    timelineTrack.innerHTML = '';

    // Sort posts by date
    const sortedByDate = [...posts].filter(p => p.date).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const oldestDate = new Date(sortedByDate[0]?.date || new Date());
    const newestDate = new Date(sortedByDate[sortedByDate.length - 1]?.date || new Date());
    const totalDays = Math.ceil((newestDate - oldestDate) / (1000 * 60 * 60 * 24));

    // Update top label
    document.querySelector('.timeline-label-top').textContent =
        oldestDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

    // Create tick marks
    const tickCount = Math.min(Math.max(Math.ceil(totalDays / 7), 10), 40);
    for (let i = 0; i <= tickCount; i++) {
        const tick = document.createElement('div');
        tick.className = 'timeline-tick';
        tick.style.top = `${(i / tickCount) * 100}%`;
        timelineTrack.appendChild(tick);
    }

    // Create post markers
    posts.forEach((post, index) => {
        if (!post.date) return;

        const postTime = new Date(post.date).getTime();
        const position = (postTime - oldestDate.getTime()) / (newestDate.getTime() - oldestDate.getTime());

        const marker = document.createElement('div');
        marker.className = 'timeline-marker';
        marker.dataset.index = index;
        marker.style.top = `${position * 100}%`;

        marker.innerHTML = `
      <span class="timeline-date-label">${formatShortDate(post.date)}</span>
      <div class="timeline-marker-bar" style="width: 1.25rem;"></div>
    `;

        marker.addEventListener('click', () => {
            activeIndex = index;
            dragProgress = 0;
            updateCards();
        });

        timelineTrack.appendChild(marker);
    });

    updateTimeline();

    // Timeline drag
    timelineTrack.addEventListener('mousedown', handleTimelineDrag);
}

function updateTimeline() {
    const markers = document.querySelectorAll('.timeline-marker');
    markers.forEach((marker, i) => {
        const index = parseInt(marker.dataset.index);
        if (index === activeIndex) {
            marker.classList.add('active');
        } else {
            marker.classList.remove('active');
        }
    });
}

function handleTimelineDrag(e) {
    const rect = timelineTrack.getBoundingClientRect();

    const updateFromMouse = (event) => {
        const y = event.clientY - rect.top;
        const percentage = Math.max(0, Math.min(1, y / rect.height));

        // Find nearest post by timeline position
        const sortedByDate = [...posts].filter(p => p.date).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const oldestDate = new Date(sortedByDate[0]?.date);
        const newestDate = new Date(sortedByDate[sortedByDate.length - 1]?.date);
        const targetTime = oldestDate.getTime() + percentage * (newestDate.getTime() - oldestDate.getTime());

        let nearestIndex = 0;
        let nearestDiff = Infinity;
        posts.forEach((post, i) => {
            if (post.date) {
                const diff = Math.abs(new Date(post.date).getTime() - targetTime);
                if (diff < nearestDiff) {
                    nearestDiff = diff;
                    nearestIndex = i;
                }
            }
        });

        activeIndex = nearestIndex;
        dragProgress = 0;
        updateCards();
    };

    const handleMouseUp = () => {
        window.removeEventListener('mousemove', updateFromMouse);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    updateFromMouse(e);
    window.addEventListener('mousemove', updateFromMouse);
    window.addEventListener('mouseup', handleMouseUp);
}

// ========================================
// Scroll/Wheel Handling
// ========================================
let wheelTimeout;

function handleWheel(e) {
    e.preventDefault();

    scrollAccumulator += e.deltaY * 0.012;

    dragProgress += scrollAccumulator;
    scrollAccumulator = 0;

    // Clamp and snap
    if (Math.abs(dragProgress) > 1) {
        const direction = dragProgress > 0 ? 1 : -1;
        const newIndex = Math.max(0, Math.min(posts.length - 1, activeIndex + direction));
        activeIndex = newIndex;
        dragProgress = 0;
    } else {
        dragProgress = Math.max(-1, Math.min(1, dragProgress));
    }

    updateCards();

    // Debounce snap
    clearTimeout(wheelTimeout);
    wheelTimeout = setTimeout(() => {
        if (Math.abs(dragProgress) > snapThreshold) {
            const direction = dragProgress > 0 ? 1 : -1;
            activeIndex = Math.max(0, Math.min(posts.length - 1, activeIndex + direction));
        }
        dragProgress = 0;
        updateCards();
    }, 40);
}

rolodexView.addEventListener('wheel', handleWheel, { passive: false });

// ========================================
// Keyboard Navigation
// ========================================
document.addEventListener('keydown', (e) => {
    if (listView.classList.contains('hidden')) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            activeIndex = Math.max(0, activeIndex - 1);
            dragProgress = 0;
            updateCards();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            activeIndex = Math.min(posts.length - 1, activeIndex + 1);
            dragProgress = 0;
            updateCards();
        }
    }
});

// ========================================
// List View
// ========================================
const listContainer = document.getElementById('list-container');
const hoverPreview = document.getElementById('hover-preview');
const hoverImage = document.getElementById('hover-image');

function createListView() {
    listContainer.innerHTML = '';

    posts.forEach((post, index) => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-item';
        item.dataset.index = index;
        item.dataset.image = post.image || '';
        item.onclick = (e) => { e.preventDefault(); alert(`Navigate to: ${post.slug}`); };

        item.innerHTML = `
      <div class="list-item-inner">
        ${post.date ? `<time class="list-date">${formatShortDate(post.date)}</time>` : '<span class="list-date"></span>'}
        <h2 class="list-title">${post.title}</h2>
        <p class="list-subtitle">${post.subtitle || post.description || ''}</p>
        <span class="list-arrow">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"></path>
          </svg>
        </span>
      </div>
    `;

        // Hover preview
        item.addEventListener('mouseenter', () => {
            if (post.image) {
                hoverImage.src = post.image;
                hoverPreview.classList.add('visible');
            }
        });

        item.addEventListener('mouseleave', () => {
            hoverPreview.classList.remove('visible');
        });

        item.addEventListener('mousemove', (e) => {
            hoverPreview.style.left = `${e.clientX + 20}px`;
            hoverPreview.style.top = `${e.clientY - 100}px`;
        });

        listContainer.appendChild(item);
    });
}

// ========================================
// Initialize
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    createCards();
    createTimeline();
    createListView();
});

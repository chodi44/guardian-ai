import { appState } from './state.js';

// Base prefix detection (supports /emergency, /guardian_emergency_portal, /police, or root /)
function getBasePrefix() {
  const p = window.location.pathname;
  if (p.startsWith('/guardian_emergency_portal')) return '/guardian_emergency_portal';
  if (p.startsWith('/emergency')) return '/emergency';
  if (p.startsWith('/police')) return '/police';
  return '';
}

const basePrefix = getBasePrefix();

const routes = {
  '/auth': {
    templateUrl: '/pages/login.html',
    scriptUrl: '/js/pages/login.js',
    cssUrl: null,
    useLayout: false
  },
  '/dashboard': {
    templateUrl: '/pages/dashboard.html',
    scriptUrl: '/js/pages/dashboard.js',
    cssUrl: '/css/dashboard.css',
    useLayout: true
  },
  '/incoming': {
    templateUrl: '/pages/incoming.html',
    scriptUrl: '/js/pages/incoming.js',
    cssUrl: '/css/incomingcase.css',
    useLayout: true
  },
  '/case/:id': {
    templateUrl: '/pages/case-detail.html',
    scriptUrl: '/js/pages/case-detail.js',
    cssUrl: '/css/casedetail.css',
    useLayout: true
  },
  '/map': {
    templateUrl: '/pages/live-map.html',
    scriptUrl: '/js/pages/live-map.js',
    cssUrl: '/css/livemap.css',
    useLayout: true
  },
  '/response': {
    templateUrl: '/pages/response-operations.html',
    scriptUrl: '/js/pages/response-operations.js',
    cssUrl: '/css/responseops.css',
    useLayout: true
  },
  '/history': {
    templateUrl: '/pages/history.html',
    scriptUrl: '/js/pages/history.js',
    cssUrl: '/css/history.css',
    useLayout: true
  },
  '/settings': {
    templateUrl: '/pages/settings.html',
    scriptUrl: '/js/pages/settings.js',
    cssUrl: '/css/settings.css',
    useLayout: true
  }
};

let currentLayout = null;

function resolveAssetUrl(relUrl) {
  if (!relUrl) return null;
  return basePrefix ? `${basePrefix}${relUrl}` : relUrl;
}

async function fetchHtml(url) {
  const resolved = resolveAssetUrl(url);
  const response = await fetch(resolved + '?t=' + Date.now());
  return await response.text();
}

function normalizePath(path) {
  let p = path || window.location.pathname;
  if (basePrefix && p.startsWith(basePrefix)) {
    p = p.substring(basePrefix.length);
  }
  if (p.endsWith('/index.html')) {
    p = p.replace('/index.html', '');
  } else if (p.endsWith('index.html')) {
    p = p.replace('index.html', '');
  }
  if (!p || p === '/' || p === '') {
    if (window.location.hash) {
      const h = window.location.hash.replace('#', '');
      return h.startsWith('/') ? h : '/' + h;
    }
    return '/dashboard';
  }
  return p.startsWith('/') ? p : '/' + p;
}

function matchRoute(path) {
  const cleanPath = normalizePath(path);
  for (const routePath in routes) {
    if (routePath.includes(':')) {
      const routeRegex = new RegExp('^' + routePath.replace(/:[^/]+/g, '([^/]+)') + '$');
      const match = cleanPath.match(routeRegex);
      if (match) {
        return { ...routes[routePath], params: { id: match[1] }, originalPath: routePath, cleanPath };
      }
    } else if (routePath === cleanPath) {
      return { ...routes[routePath], originalPath: routePath, cleanPath };
    }
  }
  return null;
}

async function navigate(path) {
  const cleanPath = normalizePath(path);
  const fullPath = basePrefix ? `${basePrefix}${cleanPath}` : cleanPath;

  if (window.location.pathname !== fullPath) {
    try {
      window.history.pushState({}, '', fullPath);
    } catch (e) {}
  }
  
  const route = matchRoute(cleanPath) || matchRoute('/dashboard') || matchRoute('/auth');
  
  if (!route) return;

  const appRoot = document.getElementById('app-root');
  const pageCss = document.getElementById('page-css');

  // Load CSS
  if (pageCss) {
    if (route.cssUrl) {
      pageCss.setAttribute('href', resolveAssetUrl(route.cssUrl) + '?t=' + Date.now());
    } else {
      pageCss.removeAttribute('href');
    }
  }

  // Handle Layout
  if (route.useLayout) {
    if (currentLayout !== 'portal') {
      const layoutHtml = await fetchHtml('/pages/layout.html');
      if (appRoot) appRoot.innerHTML = layoutHtml;
      currentLayout = 'portal';
    }
  } else {
    currentLayout = 'none';
  }

  // Handle Content
  const contentContainer = route.useLayout ? document.getElementById('portal-content') : appRoot;
  if (contentContainer) {
    const contentHtml = await fetchHtml(route.templateUrl);
    contentContainer.innerHTML = contentHtml;
  } else {
    console.error('Root container not found!');
  }

  // Update Active Nav Link
  if (route.useLayout) {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));
    let navItem = document.querySelector(`.sidebar-nav .nav-item[data-route="${cleanPath}"]`);
    if (!navItem) {
      navItem = document.querySelector(`.sidebar-nav .nav-item[href$="${cleanPath}"]`);
    }
    if (navItem) navItem.classList.add('active');
  }

  // Load Script
  if (route.scriptUrl) {
    try {
      const scriptUrl = resolveAssetUrl(route.scriptUrl);
      const module = await import(scriptUrl + '?t=' + Date.now());
      if (module.init) {
        module.init(route.params);
      }
    } catch (e) {
      console.error('Failed to load module for route', e);
    }
  }

  // Re-render lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Global hook
window.router = {
  navigate,
  go: (path) => navigate(path),
  basePrefix
};

// Handle browser back/forward
window.addEventListener('popstate', () => {
  navigate(window.location.pathname);
});

// Intercept clicks on links
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && link.getAttribute('href')) {
    const href = link.getAttribute('href');
    if (href.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault();
      navigate(href);
    } else if (href.startsWith('#')) {
      e.preventDefault();
      navigate(href.replace('#', ''));
    }
  }
});

// Init
function initRouter() {
  appState.refreshData();
  const initialPath = normalizePath(window.location.pathname);
  navigate(initialPath);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initRouter);
} else {
  initRouter();
}

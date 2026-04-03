(function () {
  'use strict';

  var STORE_KEY = 'ccls_content_v1';
  var LIGHT_THEME_LOGO = 'light_theme.png';
  var DARK_THEME_LOGO = 'dark_theme.png';
  var themeLogoObserverBound = false;

  function pageName() {
    var p = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return p || 'index.html';
  }

  function text(el, value) {
    if (!el || value === undefined || value === null) return;
    el.textContent = value;
  }

  function safeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveRemoteUrl() {
    if (window.CCLS_CONTENT_URL && typeof window.CCLS_CONTENT_URL === 'string') return window.CCLS_CONTENT_URL;

    var meta = document.querySelector('meta[name="ccls-content-url"]');
    if (meta && meta.content) return meta.content;

    var saved = localStorage.getItem('ccls_public_content_url') || sessionStorage.getItem('ccls_public_content_url');
    if (saved) return saved;

    return 'ccls-content.json';
  }

  function getLocalData() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getSavedAt(data) {
    if (!data || !data._lastSaved) return 0;
    var ts = Date.parse(data._lastSaved);
    return Number.isFinite(ts) ? ts : 0;
  }

  function hasListContent(data) {
    if (!data) return false;
    return ['events', 'articles', 'partners', 'members', 'media'].some(function (k) {
      return Array.isArray(data[k]) && data[k].length > 0;
    });
  }

  function currentThemeLogo() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? DARK_THEME_LOGO : LIGHT_THEME_LOGO;
  }

  function applyThemeAwareLogo() {
    var logoSrc = currentThemeLogo();
    document.querySelectorAll('.nav-logo-img, .footer-brand img').forEach(function (img) {
      img.src = logoSrc;
    });
  }

  function bindThemeLogoObserver() {
    if (themeLogoObserverBound) return;
    themeLogoObserverBound = true;

    var observer = new MutationObserver(function () {
      applyThemeAwareLogo();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  async function getData() {
    var localData = getLocalData();
    var remoteData = null;
    var remoteUrl = resolveRemoteUrl();
    if (remoteUrl) {
      try {
        var res = await fetch(remoteUrl + (remoteUrl.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          remoteData = await res.json();
        }
      } catch (e) {
      }
    }

    if (localData && remoteData) {
      var localTs = getSavedAt(localData);
      var remoteTs = getSavedAt(remoteData);

      if (localTs > remoteTs) return localData;
      if (remoteTs > localTs) return remoteData;

      if (hasListContent(localData) && !hasListContent(remoteData)) return localData;
      return localData;
    }

    return remoteData || localData;
  }

  function applyGlobal(data) {
    var media = data.media || [];
    var mainLogo = media.find(function (m) { return m.id === 'mainLogo'; });
    if (mainLogo && mainLogo.src) {
      document.querySelectorAll('.nav-logo-img, .footer-brand img').forEach(function (img) {
        img.src = mainLogo.src;
      });
    }

    var favicon = media.find(function (m) { return m.id === 'favicon'; });
    if (favicon && favicon.src) {
      var link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = favicon.src;
    }

    var ft = data.footer || {};
    if (ft.copyright) {
      document.querySelectorAll('.footer-bottom').forEach(function (el) {
        el.textContent = ft.copyright;
      });
    }

    if (ft.tagline) {
      var footerTagline = document.querySelector('.footer-tagline');
      if (footerTagline) footerTagline.textContent = ft.tagline;
    }

    var navLinks = [
      { label: ft.nav1lbl, url: ft.nav1url },
      { label: ft.nav2lbl, url: ft.nav2url },
      { label: ft.nav3lbl, url: ft.nav3url },
      { label: ft.nav4lbl, url: ft.nav4url }
    ].filter(function (x) { return x.label && x.url; });

    if (navLinks.length) {
      var footerCols = Array.prototype.slice.call(document.querySelectorAll('.footer-col'));
      var navigateCol = footerCols.find(function (col) {
        var h = col.querySelector('h4');
        return h && h.textContent.trim().toLowerCase() === 'navigate';
      }) || footerCols[0];

      if (navigateCol) {
        var heading = navigateCol.querySelector('h4');
        navigateCol.innerHTML = (heading ? heading.outerHTML : '<h4>Navigate</h4>') +
          navLinks.map(function (x) {
            return '<a href="' + safeHtml(x.url) + '">' + safeHtml(x.label) + '</a>';
          }).join('');
      }
    }

    var ct = data.contact || {};
    if (ct.instagram) document.querySelectorAll('a[aria-label="Instagram"], a[href*="instagram.com"]').forEach(function (a) { a.href = ct.instagram; });
    if (ct.linkedin) document.querySelectorAll('a[aria-label="LinkedIn"], a[href*="linkedin.com"]').forEach(function (a) { a.href = ct.linkedin; });
    if (ct.youtube) document.querySelectorAll('a[aria-label="YouTube"], a[href*="youtube.com"]').forEach(function (a) { a.href = ct.youtube; });
    if (ct.twitter) document.querySelectorAll('a[aria-label="X"], a[href*="x.com"], a[href*="twitter.com"]').forEach(function (a) { a.href = ct.twitter; });
    if (ct.facebook) document.querySelectorAll('a[aria-label="Facebook"], a[href*="facebook.com"]').forEach(function (a) { a.href = ct.facebook; });
    if (ct.email) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
        a.href = 'mailto:' + ct.email;
        var label = (a.textContent || '').trim();
        if (!label || label.indexOf('@') >= 0) a.textContent = ct.email;
      });
    }

    var footerCols = Array.prototype.slice.call(document.querySelectorAll('.footer-col'));
    var connectCol = footerCols.find(function (col) {
      var h = col.querySelector('h4');
      return h && h.textContent.trim().toLowerCase() === 'connect';
    });

    if (connectCol) {
      var heading = connectCol.querySelector('h4');
      var connectLinks = [
        { label: 'Instagram', url: ct.instagram },
        { label: 'LinkedIn', url: ct.linkedin },
        { label: 'YouTube', url: ct.youtube },
        { label: 'X', url: ct.twitter },
        { label: 'Facebook', url: ct.facebook },
        { label: 'Email Us', url: ct.email ? ('mailto:' + ct.email) : '' }
      ].filter(function (x) { return x.url; });

      if (connectLinks.length) {
        connectCol.innerHTML = (heading ? heading.outerHTML : '<h4>Connect</h4>') +
          connectLinks.map(function (x) {
            var external = /^https?:/i.test(x.url);
            return '<a href="' + safeHtml(x.url) + '"' + (external ? ' target="_blank" rel="noopener"' : '') + '>' + safeHtml(x.label) + '</a>';
          }).join('');
      }
    }

    // Keep logos synchronized with the active light/dark theme assets.
    applyThemeAwareLogo();
  }

  function applyHomepage(data) {
    var hp = data.homepage || {};
    if (!Object.keys(hp).length) return;

    text(document.querySelector('.hero-badge'), hp.heroBadge);

    var heroTitle = document.querySelector('.hero-title');
    if (heroTitle && hp.heroTitle) {
      var html = safeHtml(hp.heroTitle);
      if (hp.heroItalic && hp.heroTitle.indexOf(hp.heroItalic) >= 0) {
        html = safeHtml(hp.heroTitle).replace(safeHtml(hp.heroItalic), '<em>' + safeHtml(hp.heroItalic) + '</em>');
      }
      heroTitle.innerHTML = html;
    }

    text(document.querySelector('.hero-sub'), hp.heroSub);
    text(document.querySelector('.hero-btn'), hp.heroCta);

    var statItems = document.querySelectorAll('.stat-item');
    var stats = [
      { num: hp.stat1num, lbl: hp.stat1lbl },
      { num: hp.stat2num, lbl: hp.stat2lbl },
      { num: hp.stat3num, lbl: hp.stat3lbl }
    ];

    statItems.forEach(function (item, idx) {
      if (!stats[idx]) return;
      text(item.querySelector('.stat-number'), stats[idx].num);
      text(item.querySelector('.stat-label'), stats[idx].lbl);
    });

    var splits = document.querySelectorAll('.split .split-text');
    if (splits[0]) {
      text(splits[0].querySelector('h2'), hp.aboutTitle);
      var p1 = splits[0].querySelectorAll('p')[0];
      var p2 = splits[0].querySelectorAll('p')[1];
      text(p1, hp.aboutP1);
      text(p2, hp.aboutP2);
      var sig = splits[0].querySelector('.signature');
      if (sig && hp.aboutSig) sig.textContent = hp.aboutSig;
    }

    if (splits[1]) {
      var principalPs = splits[1].querySelectorAll('p');
      if (principalPs[0] && hp.picQ1) principalPs[0].innerHTML = '&ldquo;' + safeHtml(hp.picQ1) + '&rdquo;';
      if (principalPs[1] && hp.picQ2) principalPs[1].innerHTML = '&ldquo;' + safeHtml(hp.picQ2) + '&rdquo;';
      text(splits[1].querySelector('.role'), hp.picRole);
      var principalSig = splits[1].querySelector('.signature');
      if (principalSig && hp.picName) {
        principalSig.innerHTML = '<strong>' + safeHtml(hp.picName) + '</strong><br>' + safeHtml(hp.picRole || '');
      }
    }

    text(document.querySelector('.countdown-label'), hp.cdLabel);
  }

  function formatDateISO(dateValue) {
    if (!dateValue) return '';
    var d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }

  function articleDetailHref(articleId) {
    return 'article.html?id=' + encodeURIComponent(articleId || '');
  }

  var articleLookup = {};
  var articleModalBound = false;

  function articleDateText(dateValue) {
    if (!dateValue) return 'Date TBA';
    var d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return 'Date TBA';
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function articleBodyHtml(article) {
    var raw = String(article.body || article.abstract || 'Article details will be announced soon.').trim();
    if (!raw) raw = 'Article details will be announced soon.';
    return raw
      .split(/\n\s*\n+/)
      .map(function (p) { return '<p>' + safeHtml(p).replace(/\n/g, '<br>') + '</p>'; })
      .join('');
  }

  function normalizeLinkedinUrl(url) {
    var value = String(url || '').trim();
    if (!value) return '';
    if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
    return value;
  }

  function ensureArticleModal() {
    if (document.getElementById('cclsArticleModal')) return;

    var style = document.createElement('style');
    style.id = 'cclsArticleModalStyle';
    style.textContent = '' +
      '.ccls-art-modal{position:fixed;inset:0;z-index:2200;display:none}' +
      '.ccls-art-modal.is-open{display:block}' +
      '.ccls-art-modal-backdrop{position:absolute;inset:0;background:rgba(10,14,24,.62)}' +
      '.ccls-art-modal-panel{position:relative;max-width:900px;margin:40px auto;background:var(--bg,#fff);color:var(--text,#1a1a2e);border:1px solid var(--border,#e8e8e0);max-height:calc(100vh - 80px);overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.25)}' +
      '.ccls-art-head{padding:24px 24px 14px;border-bottom:1px solid var(--border,#e8e8e0);display:flex;align-items:flex-start;justify-content:space-between;gap:16px}' +
      '.ccls-art-head h3{font-family:DM Serif Display,serif;font-size:1.6rem;line-height:1.2;font-weight:400;margin:8px 0 0}' +
      '.ccls-art-tag{font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold,#c8a951)}' +
      '.ccls-art-close{border:none;background:none;color:var(--text-muted,#777);font-size:1.6rem;cursor:pointer;line-height:1}' +
      '.ccls-art-cover{height:230px;background:#f0f0ec center/cover no-repeat;display:none}' +
      '.ccls-art-cover.is-visible{display:block}' +
      '.ccls-art-body{padding:24px}' +
      '.ccls-art-body p{font-size:.92rem;line-height:1.8;color:var(--text-muted,#666);margin:0 0 14px}' +
      '.ccls-art-body p:last-child{margin-bottom:0}' +
      '.ccls-art-link{display:inline-flex;margin-top:8px;text-decoration:none;padding:10px 16px;background:var(--accent,#1a1a2e);color:#fff;font-size:.74rem;letter-spacing:.06em;text-transform:uppercase}' +
      '.ccls-art-foot{border-top:1px solid var(--border,#e8e8e0);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}' +
      '.ccls-art-author{display:flex;align-items:center;gap:10px;min-width:220px}' +
      '.ccls-art-author-photo{width:36px;height:36px;border-radius:50%;background:#ecebe3;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:600;color:#666;overflow:hidden;flex-shrink:0}' +
      '.ccls-art-author-photo img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.ccls-art-author-meta{display:flex;flex-direction:column;line-height:1.2}' +
      '.ccls-art-author-meta strong{font-size:.76rem;color:var(--text,#1a1a2e);font-weight:600}' +
      '.ccls-art-author-meta span{font-size:.7rem;color:var(--text-muted,#777)}' +
      '.ccls-art-comments{display:flex;align-items:center;gap:6px;font-size:.72rem;color:#aaa}' +
      '.ccls-art-comments svg{width:14px;height:14px;stroke:#bbb}' +
      '@media(max-width:760px){.ccls-art-modal-panel{margin:0;max-width:none;max-height:100vh;height:100vh}.ccls-art-cover{height:180px}.ccls-art-head h3{font-size:1.28rem}}';
    document.head.appendChild(style);

    var modal = document.createElement('div');
    modal.className = 'ccls-art-modal';
    modal.id = 'cclsArticleModal';
    modal.innerHTML = '' +
      '<div class="ccls-art-modal-backdrop" data-art-close="1"></div>' +
      '<div class="ccls-art-modal-panel" role="dialog" aria-modal="true" aria-labelledby="cclsArticleTitle">' +
        '<div class="ccls-art-head">' +
          '<div><div class="ccls-art-tag" id="cclsArticleCategory">Article</div><h3 id="cclsArticleTitle">Untitled Article</h3></div>' +
          '<button class="ccls-art-close" type="button" data-art-close="1" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ccls-art-cover" id="cclsArticleCover"></div>' +
        '<div class="ccls-art-body" id="cclsArticleBody"></div>' +
        '<div class="ccls-art-foot">' +
          '<div class="ccls-art-author">' +
            '<div class="ccls-art-author-photo" id="cclsArticleAuthorPhoto">A</div>' +
            '<div class="ccls-art-author-meta"><strong id="cclsArticleAuthor">CCLS Editorial</strong><span id="cclsArticleDate">Date TBA</span></div>' +
          '</div>' +
          '<div class="ccls-art-comments"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> 0</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  function closeArticleModal() {
    var modal = document.getElementById('cclsArticleModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function openArticleModal(article) {
    if (!article) return;
    ensureArticleModal();

    var modal = document.getElementById('cclsArticleModal');
    var titleEl = document.getElementById('cclsArticleTitle');
    var categoryEl = document.getElementById('cclsArticleCategory');
    var coverEl = document.getElementById('cclsArticleCover');
    var bodyEl = document.getElementById('cclsArticleBody');
    var authorEl = document.getElementById('cclsArticleAuthor');
    var dateEl = document.getElementById('cclsArticleDate');
    var photoEl = document.getElementById('cclsArticleAuthorPhoto');

    if (!modal || !titleEl || !categoryEl || !coverEl || !bodyEl || !authorEl || !dateEl || !photoEl) return;

    titleEl.textContent = article.title || 'Untitled Article';
    categoryEl.textContent = article.category || 'Article';
    authorEl.textContent = article.author || 'CCLS Editorial';
    dateEl.textContent = articleDateText(article.date);

    if (article.image) {
      coverEl.style.backgroundImage = 'url("' + safeHtml(article.image) + '")';
      coverEl.classList.add('is-visible');
    } else {
      coverEl.style.backgroundImage = '';
      coverEl.classList.remove('is-visible');
    }

    if (article.authorImage) {
      photoEl.innerHTML = '<img src="' + safeHtml(article.authorImage) + '" alt="' + safeHtml(article.author || 'Author') + '">';
    } else {
      photoEl.textContent = (article.author || 'A').trim().charAt(0).toUpperCase() || 'A';
    }

    var html = articleBodyHtml(article);
    if (article.link) {
      html += '<a class="ccls-art-link" href="' + safeHtml(article.link) + '" target="_blank" rel="noopener">Read Full Article</a>';
    }
    bodyEl.innerHTML = html;

    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function bindArticleModalEvents() {
    if (articleModalBound) return;
    articleModalBound = true;

    document.addEventListener('click', function (event) {
      var closeEl = event.target.closest('[data-art-close="1"]');
      if (closeEl) {
        event.preventDefault();
        closeArticleModal();
        return;
      }

      var opener = event.target.closest('.js-article-open');
      if (!opener) return;

      event.preventDefault();
      var articleId = opener.getAttribute('data-article-id') || '';
      if (!articleId || !articleLookup[articleId]) return;
      openArticleModal(articleLookup[articleId]);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeArticleModal();
    });
  }

  function applyEvents(data) {
    var events = (data.events || []).filter(function (e) { return e.status === 'published'; });
    if (!events.length) return;

    var listShell = document.querySelector('.ev-card-inner');
    if (listShell) {
      listShell.innerHTML = events.map(function (ev) {
        var venue = ev.venue || 'Campus Law Centre';
        var thumb = ev.image
          ? '<img src="' + safeHtml(ev.image) + '" alt="' + safeHtml(ev.title || 'Event') + '">'
          : 'EV';
        return '<div class="ev-item">' +
          '<div class="ev-thumb">' + thumb + '</div>' +
          '<div class="ev-info">' +
            '<div class="ev-date">' + safeHtml(formatDateISO(ev.date) || 'Date TBA') + '</div>' +
            '<div class="ev-name">' + safeHtml(ev.title || 'Untitled Event') + ' <span>/ ' + safeHtml(venue) + '</span></div>' +
          '</div>' +
          '<button class="ev-btn js-event-details"' +
            ' data-date="' + safeHtml(formatDateISO(ev.date) || 'Date TBA') + '"' +
            ' data-title="' + safeHtml(ev.title || 'Untitled Event') + '"' +
            ' data-venue="' + safeHtml(venue) + '"' +
            ' data-time="' + safeHtml(ev.time || 'Time TBA') + '"' +
            ' data-category="' + safeHtml(ev.category || 'General') + '"' +
            ' data-description="' + safeHtml(ev.desc || 'More details will be announced soon.') + '">Details</button>' +
        '</div>';
      }).join('');

      var label = document.querySelector('.ev-cd-label');
      if (label && events[0] && events[0].title) label.textContent = events[0].title;
      return;
    }

    var cardGrid = document.querySelector('.events-grid');
    if (cardGrid) {
      cardGrid.innerHTML = events.map(function (ev) {
        return '<div class="event-card"><div class="event-card-body">' +
          '<h3>' + safeHtml(ev.title || 'Untitled Event') + '</h3>' +
          '<p>' + safeHtml(ev.desc || '') + '</p>' +
          '<div class="event-meta">' + safeHtml(ev.category || 'General') + (ev.venue ? ' · ' + safeHtml(ev.venue) : '') + '</div>' +
        '</div></div>';
      }).join('');
    }
  }

  function applyArticles(data) {
    var articles = (data.articles || []).filter(function (a) { return a.status === 'published'; });
    if (!articles.length) return;

    articleLookup = {};
    articles.forEach(function (a, idx) {
      var id = a.id || ('art_' + idx);
      a.id = id;
      articleLookup[id] = a;
    });

    var grid = document.querySelector('.articles-grid');
    if (grid) {
      grid.innerHTML = articles.map(function (a) {
        var dateText = a.date ? new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        var action = '<a class="read-more" href="' + safeHtml(articleDetailHref(a.id)) + '">Read Full Article</a>';

        return '<article class="article-card">' +
          '<div><span class="article-tag">' + safeHtml(a.category || 'Article') + '</span>' +
          '<h3>' + safeHtml(a.title || 'Untitled') + '</h3>' +
          '<p>' + safeHtml(a.abstract || '') + '</p></div>' +
          '<div class="article-meta"><span class="author">' + safeHtml(a.author || 'CCLS') + '</span><span>' + safeHtml(dateText) + '</span></div>' +
          action +
        '</article>';
      }).join('');
    }

    var blogGrid = document.querySelector('.blog-g');
    if (blogGrid) {
      blogGrid.innerHTML = articles.map(function (a) {
        var d = a.date ? new Date(a.date) : null;
        var dateText = d ? d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA';
        var words = ((a.body || a.abstract || '').trim().split(/\s+/).filter(Boolean).length) || 220;
        var minRead = Math.max(1, Math.round(words / 220));
        var excerpt = a.abstract || a.body || '';
        var shortExcerpt = excerpt.length > 170 ? excerpt.slice(0, 167) + '...' : excerpt;
        var imageStyle = a.image ? ' style="background-image:url(' + "'" + safeHtml(a.image) + "'" + ')"' : '';
        var authorName = safeHtml(a.author || 'CCLS Editorial');
        var authorAvatar = a.authorImage
          ? '<img src="' + safeHtml(a.authorImage) + '" alt="' + authorName + '" style="width:100%;height:100%;object-fit:cover;display:block">'
          : safeHtml((a.author || 'A').trim().charAt(0).toUpperCase() || 'A');
        var authorLinkedin = normalizeLinkedinUrl(a.authorLinkedin);
        var linkedinTag = authorLinkedin
          ? '<a class="pc-li-tag" href="' + safeHtml(authorLinkedin) + '" target="_blank" rel="noopener" aria-label="Author LinkedIn">LinkedIn</a>'
          : '<span class="pc-li-tag is-disabled" aria-hidden="true">LinkedIn</span>';

        return '<a href="' + safeHtml(articleDetailHref(a.id)) + '" class="pc">' +
          '<div class="pc-img"' + imageStyle + '></div>' +
          '<div class="pc-bd">' +
            '<div class="pc-mt"><span>' + safeHtml(dateText) + ' · ' + minRead + ' min read</span><span class="pc-dt">&#8942;</span></div>' +
            '<h3>' + safeHtml(a.title || 'Untitled') + '</h3>' +
            '<p class="ex">By ' + safeHtml(a.author || 'CCLS Editorial') + ' ' + safeHtml(shortExcerpt) + '</p>' +
          '</div>' +
          '<div class="pc-ft" style="justify-content:space-between;gap:12px">' +
            '<div style="display:flex;align-items:center;gap:8px;min-width:0;">' +
              '<div style="width:24px;height:24px;border-radius:50%;overflow:hidden;background:#ecebe3;color:#6b6b80;font-size:.72rem;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + authorAvatar + '</div>' +
              '<div style="display:flex;flex-direction:column;min-width:0;line-height:1.15">' +
                '<strong style="font-size:.68rem;color:#666;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:155px">' + authorName + '</strong>' +
                '<span style="font-size:.64rem;color:#9a9a9a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:155px">' + safeHtml(dateText) + '</span>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' + linkedinTag + '</div>' +
          '</div>' +
        '</a>';
      }).join('');
    }
  }

  function applyArticleDetail(data) {
    var all = (data.articles || []).filter(function (a) { return a.status === 'published'; });
    if (!all.length) return;

    var params = new URLSearchParams(window.location.search || '');
    var id = params.get('id') || '';
    var article = all.find(function (a) { return String(a.id || '') === id; }) || all[0];

    var dateText = articleDateText(article.date);
    text(document.getElementById('articleMetaCategory'), article.category || 'Article');
    text(document.getElementById('articleHeroTitle'), article.title || 'Untitled Article');
    text(document.getElementById('articleMetaAuthor'), article.author || 'CCLS Editorial');
    text(document.getElementById('articleMetaDate'), dateText);
    text(document.getElementById('articleAuthorName'), article.author || 'CCLS Editorial');
    text(document.getElementById('articleAuthorDate'), dateText);
    text(document.getElementById('articleAuthorSpotlightName'), article.author || 'CCLS Editorial');

    var cover = document.getElementById('articleCover');
    if (cover && article.image) {
      cover.style.backgroundImage = 'url("' + safeHtml(article.image) + '")';
      cover.classList.add('has-image');
    }

    var photo = document.getElementById('articleAuthorPhoto');
    var passport = document.getElementById('articleAuthorPassport');
    var authorFallback = (article.author || 'A').trim().charAt(0).toUpperCase() || 'A';
    if (photo) {
      if (article.authorImage) {
        photo.innerHTML = '<img src="' + safeHtml(article.authorImage) + '" alt="' + safeHtml(article.author || 'Author') + '">';
      } else {
        photo.textContent = authorFallback;
      }
    }

    if (passport) {
      if (article.authorImage) {
        passport.innerHTML = '<img src="' + safeHtml(article.authorImage) + '" alt="' + safeHtml(article.author || 'Author') + '">';
      } else {
        passport.textContent = authorFallback;
      }
    }

    var linkedin = document.getElementById('articleAuthorSpotlightLinkedin');
    var footerLinkedin = document.getElementById('articleAuthorLinkedin');
    var linkedinUrl = normalizeLinkedinUrl(article.authorLinkedin);
    if (linkedin) {
      if (linkedinUrl) {
        linkedin.href = linkedinUrl;
        linkedin.style.display = 'inline-flex';
      } else {
        linkedin.removeAttribute('href');
        linkedin.style.display = 'none';
      }
    }
    if (footerLinkedin) {
      if (linkedinUrl) {
        footerLinkedin.href = linkedinUrl;
        footerLinkedin.style.display = 'inline-flex';
      } else {
        footerLinkedin.removeAttribute('href');
        footerLinkedin.style.display = 'none';
      }
    }

    var messageWrap = document.getElementById('articleAuthorMessageWrap');
    var messageEl = document.getElementById('articleAuthorMessage');
    var authorMessage = String(article.authorMessage || '').trim();
    if (messageEl) messageEl.textContent = authorMessage;
    if (messageWrap) messageWrap.style.display = authorMessage ? 'block' : 'none';

    var body = document.getElementById('articleContent');
    if (body) {
      var html = articleBodyHtml(article);
      if (article.link) {
        html += '<p><a class="article-external-link" href="' + safeHtml(article.link) + '" target="_blank" rel="noopener">Open Source Link</a></p>';
      }
      body.innerHTML = html;
    }

    if (article.title) document.title = safeHtml(article.title) + ' | CCLS';
  }

  function partnerInitials(name) {
    var clean = String(name || '').trim();
    if (!clean) return 'P';
    var parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function applyPartners(data) {
    var partners = (data.partners || [])
      .filter(function (p) { return (p.status || 'active') !== 'inactive'; })
      .sort(function (a, b) { return (a.order || 999) - (b.order || 999); });

    var stripPartners = partners.length ? partners : [
      { name: 'Government Partners', url: 'partners-government.html' },
      { name: 'Academic Partners', url: 'partners-academic.html' },
      { name: 'Industry Partners', url: 'partners-industry.html' },
      { name: 'Knowledge Partners', url: 'partners-knowledge.html' }
    ];

    var marqueeTracks = document.querySelectorAll('.marquee-track');
    if (marqueeTracks.length) {
      var cards = stripPartners.map(function (p) {
        var logo = p.logo
          ? '<img src="' + safeHtml(p.logo) + '" alt="' + safeHtml(p.name || 'Partner') + '" style="height:22px;max-width:72px;object-fit:contain">'
          : '<span class="partner-diamond" aria-hidden="true">◆</span>';
        var href = p.url ? safeHtml(p.url) : '#';
        var extra = p.url ? ' target="_blank" rel="noopener"' : '';
        return '<a class="partner-logo" href="' + href + '"' + extra + '>' + logo + '<span>' + safeHtml(p.name || 'Partner') + '</span></a>';
      });
      var cardsHtml = cards.concat(cards).join('');
      marqueeTracks.forEach(function (track) {
        track.innerHTML = cardsHtml;
      });
    }

    if (!partners.length) return;

    var page = pageName();

    var catMap = {
      'partners-government.html': 'government',
      'partners-academic.html': 'academic',
      'partners-industry.html': 'industry',
      'partners-knowledge.html': 'knowledge'
    };
    var targetCategory = catMap[page];
    if (!targetCategory) return;

    var categoryPartners = partners.filter(function (p) {
      return String(p.category || '').trim().toLowerCase() === targetCategory;
    });

    if (!categoryPartners.length) return;

    var detailGrids = document.querySelectorAll('.pdetail-section .pcard-grid');
    if (!detailGrids.length) return;

    function cardHtml(p, isSponsor) {
      var logo = p.logo
        ? '<img src="' + safeHtml(p.logo) + '" alt="' + safeHtml(p.name || 'Partner') + '" style="width:100%;height:100%;object-fit:contain;display:block">'
        : safeHtml(partnerInitials(p.name));
      var title = p.url
        ? '<a href="' + safeHtml(p.url) + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">' + safeHtml(p.name || 'Partner') + '</a>'
        : safeHtml(p.name || 'Partner');
      return '<div class="pcard">' +
        '<div class="pcard-logo">' + logo + '</div>' +
        '<h4>' + title + '</h4>' +
        '<p>' + safeHtml(p.desc || 'Strategic collaboration with CCLS initiatives.') + '</p>' +
        '<span class="pcard-tag ' + (isSponsor ? 'tag-sponsor' : 'tag-partner') + '">' + (isSponsor ? 'Sponsor' : 'Partner') + '</span>' +
      '</div>';
    }

    var partnerItems = categoryPartners.filter(function (p) { return (p.type || 'partner') !== 'sponsor'; });
    var sponsorItems = categoryPartners.filter(function (p) { return (p.type || 'partner') === 'sponsor'; });

    detailGrids[0].innerHTML = partnerItems.length
      ? partnerItems.map(function (p) { return cardHtml(p, false); }).join('')
      : '<div class="pcard"><h4>No partners yet</h4><p>Add partners from the admin portal to show them here.</p><span class="pcard-tag tag-partner">Partner</span></div>';

    if (detailGrids[1]) {
      detailGrids[1].innerHTML = sponsorItems.length
        ? sponsorItems.map(function (p) { return cardHtml(p, true); }).join('')
        : '<div class="pcard"><h4>No sponsors yet</h4><p>Add sponsors from the admin portal to show them here.</p><span class="pcard-tag tag-sponsor">Sponsor</span></div>';
    }
  }

  function applyContact(data) {
    var ct = data.contact || {};
    if (!Object.keys(ct).length) return;

    if (ct.email) {
      document.querySelectorAll('.contact-detail div, .ct-item p').forEach(function (el) {
        if ((el.textContent || '').indexOf('@') >= 0) el.textContent = ct.email;
      });

      document.querySelectorAll('.ct-email-link').forEach(function (a) {
        a.href = 'mailto:' + ct.email;
        a.textContent = ct.email;
      });
    }

    if (ct.phone) {
      document.querySelectorAll('.contact-detail div, .ct-item p').forEach(function (el) {
        if (/\+?\d[\d\s-]{6,}/.test(el.textContent || '')) el.textContent = ct.phone;
      });
    }

    var mapUrl = ct.locationMap || ct.map || '';
    var addressText = ct.address || 'Campus Law Centre, Faculty of Law, University of Delhi';
    document.querySelectorAll('.ct-location-link').forEach(function (a) {
      if (mapUrl) a.href = mapUrl;
      a.textContent = addressText;
    });

    if (ct.instagram) {
      document.querySelectorAll('.ct-instagram-link').forEach(function (a) {
        a.href = ct.instagram;
      });
    }

    if (ct.linkedin) {
      document.querySelectorAll('.ct-linkedin-link').forEach(function (a) {
        a.href = ct.linkedin;
      });
    }

    var form = document.getElementById('ctContactForm');
    if (!form || form.dataset.mailtoBound === '1') return;
    form.dataset.mailtoBound = '1';

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var to = (ct.formEmail || ct.email || 'ccls@clc.du.ac.in').trim();
      if (!to) return;

      var firstName = (document.getElementById('ctFirstName') || {}).value || '';
      var lastName = (document.getElementById('ctLastName') || {}).value || '';
      var senderEmail = (document.getElementById('ctSenderEmail') || {}).value || '';
      var subjectInput = (document.getElementById('ctSubject') || {}).value || '';
      var message = (document.getElementById('ctMessage') || {}).value || '';

      var fullName = (firstName + ' ' + lastName).trim();
      var subject = subjectInput || 'Website Contact Form Submission';
      var bodyLines = [
        'Name: ' + (fullName || 'N/A'),
        'Email: ' + (senderEmail || 'N/A'),
        '',
        'Message:',
        message || 'N/A'
      ];

      var mailto = 'mailto:' + encodeURIComponent(to) +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(bodyLines.join('\n'));

      window.location.href = mailto;
    });
  }

  function applyOrganogram(data) {
    var members = (data.members || []).slice().sort(function (a, b) { return (a.order || 99) - (b.order || 99); });

    function linkedinTag(url) {
      var href = (url || '').trim() || '#';
      var attrs = href === '#'
        ? 'href="#"'
        : 'href="' + safeHtml(href) + '" target="_blank" rel="noopener"';
      return '<a class="cas-linkedin-tag" ' + attrs + '>LinkedIn</a>';
    }

    function ensureOrganogramLinkedinTags() {
      document.querySelectorAll('.cas-card .cas-info').forEach(function (info) {
        if (info.querySelector('.cas-linkedin-tag')) return;
        var card = info.closest('.cas-card');
        var url = (card && card.getAttribute('data-linkedin')) || '';
        info.insertAdjacentHTML('beforeend', linkedinTag(url));
      });
    }

    function renderTeacherConveners() {
      var allSections = document.querySelectorAll('.cas-team-section');
      var topSection = allSections[0];
      if (!topSection) return;

      var teacherConveners = members.filter(function (m) {
        var tier = (m.tier || '').toLowerCase();
        return tier === 'teacher conveners' || tier === 'teacher committe' || tier === 'teacher committee';
      });

      if (!teacherConveners.length) {
        ensureOrganogramLinkedinTags();
        return;
      }

      var header = topSection.querySelector('.cas-team-header');
      var html = '';
      html += '<div class="cas-tier-label">Teacher Committee</div>';
      html += '<div class="cas-team-grid cas-team-grid-3" style="max-width:900px;margin:0 auto 40px">';
      html += teacherConveners.map(function (m) {
        var avatar = m.photo
          ? '<img src="' + safeHtml(m.photo) + '" alt="' + safeHtml(m.name || 'Teacher Committee') + '">'
          : safeHtml((m.name || 'T').charAt(0));
        return '<div class="cas-card"' + (m.linkedin ? ' data-linkedin="' + safeHtml(m.linkedin) + '"' : '') + '><div class="cas-photo">' + avatar + '</div><div class="cas-info"><div class="cas-role">Teacher Committee</div><div class="cas-name">' + safeHtml(m.name || '') + '</div>' + linkedinTag(m.linkedin) + '</div></div>';
      }).join('');
      html += '</div>';

      topSection.innerHTML = (header ? header.outerHTML : '') + html;
    }

    if (!members.length) {
      ensureOrganogramLinkedinTags();
      return;
    }

    renderTeacherConveners();

    var teamSection = document.querySelectorAll('.cas-team-section')[1];
    if (!teamSection) return;

    var grouped = {};
    members.forEach(function (m) {
      if (((m.tier || '').toLowerCase() === 'teacher conveners' || (m.tier || '').toLowerCase() === 'teacher committe' || (m.tier || '').toLowerCase() === 'teacher committee')) return;
      var tier = m.tier || 'Team';
      if (!grouped[tier]) grouped[tier] = [];
      grouped[tier].push(m);
    });

    if (!Object.keys(grouped).length) {
      ensureOrganogramLinkedinTags();
      return;
    }

    var html = '';
    Object.keys(grouped).forEach(function (tier) {
      html += '<div class="cas-tier-label">' + safeHtml(tier) + '</div>';
      html += '<div class="cas-team-grid" style="max-width:1000px;margin:0 auto 40px">';
      html += grouped[tier].map(function (m) {
        var avatar = m.photo ? '<img src="' + safeHtml(m.photo) + '" alt="' + safeHtml(m.name || 'Member') + '">' : safeHtml((m.name || 'M').charAt(0));
        return '<div class="cas-card"' + (m.linkedin ? ' data-linkedin="' + safeHtml(m.linkedin) + '"' : '') + '><div class="cas-photo">' + avatar + '</div><div class="cas-info"><div class="cas-role">' + safeHtml(m.role || 'Member') + '</div><div class="cas-name">' + safeHtml(m.name || '') + '</div>' + linkedinTag(m.linkedin) + '</div></div>';
      }).join('');
      html += '</div>';
    });

    var header = teamSection.querySelector('.cas-team-header');
    teamSection.innerHTML = (header ? header.outerHTML : '') + html;
    ensureOrganogramLinkedinTags();
  }

  (async function init() {
    bindThemeLogoObserver();
    applyThemeAwareLogo();

    var data = await getData();
    if (!data || typeof data !== 'object') return;

    applyGlobal(data);

    var page = pageName();
    if (page === 'index.html' || page === '') applyHomepage(data);
    if (page === 'events.html') applyEvents(data);
    if (page === 'articles.html') applyArticles(data);
    if (page === 'article.html') applyArticleDetail(data);
    if (page === 'index.html' || page.indexOf('partners') === 0) applyPartners(data);
    if (page === 'contact.html') applyContact(data);
    if (page === 'faculty-team.html') applyOrganogram(data);
  })();
})();

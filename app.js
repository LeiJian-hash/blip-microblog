/**
 * Blip —— 本地微动态
 * 纯 HTML / CSS / JavaScript 实现，数据保存在浏览器 localStorage 中。
 */
(function () {
  'use strict';

  /** 存储键名 */
  var STORAGE_KEY = 'blip.posts.v1';
  var AUTHOR_KEY = 'blip.author.v1';

  var MAX_LENGTH = 280;
  var DEFAULT_AUTHOR = '匿名用户';

  /** 页面元素 */
  var els = {
    authorInput: document.getElementById('authorInput'),
    contentInput: document.getElementById('contentInput'),
    publishBtn: document.getElementById('publishBtn'),
    counter: document.getElementById('counter'),
    errorMsg: document.getElementById('errorMsg'),
    postList: document.getElementById('postList'),
    emptyState: document.getElementById('emptyState'),
    postCount: document.getElementById('postCount'),
    composerAvatar: document.getElementById('composerAvatar'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    template: document.getElementById('postTemplate')
  };

  /** 内存中的动态列表（最新的排在最前面） */
  var posts = [];

  /* ----------------------------- 数据层 ----------------------------- */

  function safeParse(json, fallback) {
    try {
      var data = JSON.parse(json);
      return data === null || data === undefined ? fallback : data;
    } catch (err) {
      return fallback;
    }
  }

  function loadPosts() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      showError('当前浏览器禁用了本地存储，数据将无法保存。');
      return [];
    }
    var data = safeParse(raw, []);
    if (!Array.isArray(data)) return [];
    // 过滤掉结构异常的记录，避免渲染报错
    return data.filter(function (item) {
      return item && typeof item.content === 'string';
    });
  }

  function savePosts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
      return true;
    } catch (err) {
      showError('保存失败：本地存储空间不足或被禁用。');
      return false;
    }
  }

  function loadAuthor() {
    try {
      return localStorage.getItem(AUTHOR_KEY) || '';
    } catch (err) {
      return '';
    }
  }

  function saveAuthor(name) {
    try {
      localStorage.setItem(AUTHOR_KEY, name);
    } catch (err) {
      /* 昵称保存失败不影响主流程 */
    }
  }

  /* ----------------------------- 工具函数 ----------------------------- */

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  /** 相对时间：刚刚 / x 分钟前 / x 小时前 / 月-日 时:分 */
  function formatTime(timestamp) {
    var diff = Date.now() - timestamp;
    if (diff < 0) diff = 0;
    var minute = 60 * 1000;
    var hour = 60 * minute;
    var day = 24 * hour;

    if (diff < minute) return '刚刚';
    if (diff < hour) return Math.floor(diff / minute) + ' 分钟前';
    if (diff < day) return Math.floor(diff / hour) + ' 小时前';
    if (diff < day * 7) return Math.floor(diff / day) + ' 天前';

    var d = new Date(timestamp);
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function initialOf(name) {
    var trimmed = (name || '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : DEFAULT_AUTHOR.charAt(0);
  }

  function showError(message) {
    els.errorMsg.textContent = message;
    els.errorMsg.hidden = false;
  }

  function clearError() {
    els.errorMsg.hidden = true;
    els.errorMsg.textContent = '';
  }

  /* ----------------------------- 渲染层 ----------------------------- */

  function renderList() {
    els.postList.innerHTML = '';

    var hasPosts = posts.length > 0;
    els.emptyState.hidden = hasPosts;
    els.postList.hidden = !hasPosts;
    els.postCount.textContent = posts.length + ' 条动态';

    if (!hasPosts) return;

    var fragment = document.createDocumentFragment();

    posts.forEach(function (post) {
      var node = els.template.content.firstElementChild.cloneNode(true);

      node.dataset.id = post.id;
      node.querySelector('[data-field="avatar"]').textContent = initialOf(post.author);
      node.querySelector('[data-field="author"]').textContent =
        post.author || DEFAULT_AUTHOR;
      node.querySelector('[data-field="time"]').textContent = formatTime(post.createdAt);
      node.querySelector('[data-field="time"]').title = new Date(post.createdAt).toLocaleString();
      node.querySelector('[data-field="content"]').textContent = post.content;

      fragment.appendChild(node);
    });

    els.postList.appendChild(fragment);
  }

  function updateCounter() {
    var length = els.contentInput.value.length;
    els.counter.textContent = length + ' / ' + MAX_LENGTH;
    els.counter.classList.toggle('is-warning', length > MAX_LENGTH - 40 && length <= MAX_LENGTH);
    els.counter.classList.toggle('is-over', length > MAX_LENGTH);
    els.publishBtn.disabled = length === 0 || length > MAX_LENGTH;
  }

  function updateComposerAvatar() {
    els.composerAvatar.textContent = initialOf(els.authorInput.value);
  }

  /* ----------------------------- 交互逻辑 ----------------------------- */

  function handlePublish() {
    var content = els.contentInput.value.trim();
    var author = els.authorInput.value.trim();

    if (!content) {
      showError('内容不能为空。');
      els.contentInput.focus();
      return;
    }
    if (content.length > MAX_LENGTH) {
      showError('内容超出 ' + MAX_LENGTH + ' 字上限。');
      return;
    }

    clearError();

    posts.unshift({
      id: createId(),
      author: author || DEFAULT_AUTHOR,
      content: content,
      createdAt: Date.now()
    });

    if (savePosts()) {
      els.contentInput.value = '';
      saveAuthor(author);
      updateCounter();
      renderList();
    }

    els.contentInput.focus();
  }

  function handleDelete(id) {
    var target = posts.filter(function (post) {
      return post.id === id;
    })[0];
    if (!target) return;

    var preview = target.content.length > 20
      ? target.content.slice(0, 20) + '…'
      : target.content;
    if (!window.confirm('确定删除这条动态吗？\n\n' + preview)) return;

    posts = posts.filter(function (post) {
      return post.id !== id;
    });
    savePosts();
    renderList();
  }

  function handleClearAll() {
    if (posts.length === 0) {
      showError('目前没有可清空的数据。');
      return;
    }
    if (!window.confirm('将删除全部 ' + posts.length + ' 条动态，且无法恢复，确定继续吗？')) {
      return;
    }
    posts = [];
    savePosts();
    clearError();
    renderList();
  }

  function bindEvents() {
    els.publishBtn.addEventListener('click', handlePublish);

    els.contentInput.addEventListener('input', function () {
      clearError();
      updateCounter();
    });

    els.authorInput.addEventListener('input', updateComposerAvatar);

    // Ctrl / Cmd + Enter 快捷发布
    els.contentInput.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handlePublish();
      }
    });

    // 事件委托：删除按钮
    els.postList.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-action="delete"]');
      if (!btn) return;
      var item = btn.closest('.post');
      if (item && item.dataset.id) handleDelete(item.dataset.id);
    });

    els.clearAllBtn.addEventListener('click', handleClearAll);
  }

  /* ----------------------------- 启动 ----------------------------- */

  function init() {
    posts = loadPosts();
    els.authorInput.value = loadAuthor();

    updateComposerAvatar();
    updateCounter();
    renderList();
    bindEvents();

    els.contentInput.focus();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

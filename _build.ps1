
$dir     = $PSScriptRoot
$beeB64  = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$dir\IBM Bee.png"))
$bobB64  = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$dir\IBM Bob - Full.png"))
$css     = [IO.File]::ReadAllText("$dir\style.css",  [Text.Encoding]::UTF8)
$adminJs = [IO.File]::ReadAllText("$dir\admin.js",   [Text.Encoding]::UTF8)
$gameJs  = [IO.File]::ReadAllText("$dir\game.js",    [Text.Encoding]::UTF8)

$beeDataUri = "data:image/png;base64,$beeB64"
$bobDataUri = "data:image/png;base64,$bobB64"

$adminJs = $adminJs.Replace('IBM Bee.png',        $beeDataUri)
$adminJs = $adminJs.Replace('IBM Bob - Full.png', $bobDataUri)
$gameJs  = $gameJs.Replace('IBM Bee.png',         $beeDataUri)

# Wrap everything in DOMContentLoaded; clear stale localStorage first
$allJs = "document.addEventListener('DOMContentLoaded', function() {`n" +
         "try { localStorage.removeItem('ibm_bee_catcher_config'); } catch(e) {}`n" +
         "// === ADMIN ===`n" + $adminJs + "`n" +
         "// === GAME ===`n"  + $gameJs  + "`n" +
         "}); // end DOMContentLoaded`n"

$html  = '<!DOCTYPE html>' + "`n"
$html += '<html lang="en">' + "`n"
$html += '<head>' + "`n"
$html += '  <meta charset="UTF-8">' + "`n"
$html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">' + "`n"
$html += '  <title>IBM Bee Catcher</title>' + "`n"
$html += '  <style>' + "`n" + $css + "`n" + '  </style>' + "`n"
$html += '</head>' + "`n"
$html += '<body>' + "`n"

# All screens start with display:none via inline style; JS sets display:flex on the active one
$html += '  <div id="start-screen" class="screen" style="display:none">' + "`n"
$html += '    <div class="logo-area">' + "`n"
$html += "      <img src=`"$beeDataUri`" alt=`"IBM Bee`" class=`"bee-logo`">" + "`n"
$html += '      <h1 id="game-title">IBM Bee Catcher</h1>' + "`n"
$html += '    </div>' + "`n"
$html += '    <p class="subtitle">Tap or click as many bees as you can before time runs out!</p>' + "`n"
$html += '    <button id="btn-start" class="btn-primary">Start Game</button>' + "`n"
$html += '    <footer id="game-footer">' + "`n"
$html += "      <img src=`"$bobDataUri`" alt=`"IBM Bob`" class=`"footer-bob-logo`">" + "`n"
$html += '      <span>Powered by IBM Bob</span>' + "`n"
$html += '    </footer>' + "`n"
$html += '  </div>' + "`n"

$html += '  <div id="game-screen" class="screen" style="display:none">' + "`n"
$html += '    <div id="game-hud">' + "`n"
$html += '      <div id="hud-score">0</div>' + "`n"
$html += '      <div id="hud-timer">10</div>' + "`n"
$html += '      <div id="hud-label">seconds left</div>' + "`n"
$html += '    </div>' + "`n"
$html += '    <div id="game-canvas-area">' + "`n"
$html += '      <canvas id="bg-canvas"></canvas>' + "`n"
$html += '    </div>' + "`n"
$html += '  </div>' + "`n"

$html += '  <div id="result-screen" class="screen" style="display:none">' + "`n"
$html += '    <div id="result-header">' + "`n"
$html += "      <h2>Time's up!</h2>" + "`n"
$html += '      <div id="result-bees">0<span>bees caught!</span></div>' + "`n"
$html += '    </div>' + "`n"
$html += '    <div id="result-body">' + "`n"
$html += '      <div id="result-prize-box">' + "`n"
$html += '        <div class="prize-label">You won</div>' + "`n"
$html += '        <div class="prize-name">&#8212;</div>' + "`n"
$html += '        <div class="prize-gift">&#8212;</div>' + "`n"
$html += '      </div>' + "`n"
$html += '      <div id="result-gift-panel">' + "`n"
$html += '        <img id="prize-gift-img" class="prize-gift-img hidden" src="" alt="Gift image">' + "`n"
$html += '      </div>' + "`n"
$html += "      <p id=`"result-no-prize`" class=`"hidden`">Keep practising &#8212; you'll catch more next time!</p>" + "`n"
$html += '    </div>' + "`n"
$html += '    <div id="result-footer-row">' + "`n"
$html += '      <button id="btn-play-again" class="btn-primary">Play Again</button>' + "`n"
$html += '    </div>' + "`n"
$html += '  </div>' + "`n"

$html += '  <div id="password-modal" class="hidden">' + "`n"
$html += '    <div id="password-box">' + "`n"
$html += '      <h3>Admin Access</h3>' + "`n"
$html += '      <p>Enter your password to access the admin dashboard.</p>' + "`n"
$html += '      <input type="password" id="password-input" placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;" autocomplete="off">' + "`n"
$html += '      <div id="password-error"></div>' + "`n"
$html += '      <div class="btn-row">' + "`n"
$html += '        <button id="btn-pw-cancel">Cancel</button>' + "`n"
$html += '        <button id="btn-pw-confirm">Enter</button>' + "`n"
$html += '      </div>' + "`n"
$html += '    </div>' + "`n"
$html += '  </div>' + "`n"

$html += '  <div id="admin-overlay" class="hidden">' + "`n"
$html += '    <div id="admin-panel">' + "`n"
$html += '      <h2>&#9881; Admin Dashboard</h2>' + "`n"
$html += '      <!-- Today''s Distribution -->' + "`n"
$html += '      <div class="admin-section">' + "`n"
$html += '        <div class="daily-stats-header">' + "`n"
$html += '          <h3>Today''s Distribution</h3>' + "`n"
$html += '          <span id="daily-stats-total" class="daily-total-badge">0</span>' + "`n"
$html += '          <span class="daily-stats-date" id="daily-stats-date"></span>' + "`n"
$html += '        </div>' + "`n"
$html += '        <p class="inv-note">Live count of gifts distributed today across all devices. Updates automatically in real time.</p>' + "`n"
$html += '        <table class="inv-table">' + "`n"
$html += '          <thead><tr>' + "`n"
$html += '            <th>Tier</th><th>Gift A</th><th>Distributed</th><th>Gift B</th><th>Distributed</th><th>Total</th>' + "`n"
$html += '          </tr></thead>' + "`n"
$html += '          <tbody id="daily-stats-body"></tbody>' + "`n"
$html += '        </table>' + "`n"
$html += '      </div>' + "`n"
$html += '      <div class="admin-section">' + "`n"
$html += '        <h3>Appearance</h3>' + "`n"
$html += '        <div class="admin-row">' + "`n"
$html += '          <label for="input-game-title">Game title</label>' + "`n"
$html += '          <input type="text" id="input-game-title" placeholder="IBM Bee Catcher" style="width:200px;">' + "`n"
$html += '        </div>' + "`n"
$html += '        <div class="admin-row">' + "`n"
$html += '          <label for="input-accent-color">Accent colour (title &amp; buttons)</label>' + "`n"
$html += '          <input type="color" id="input-accent-color" value="#f1c21b" style="width:56px;height:36px;padding:2px;border-radius:4px;border:1px solid #444;background:#2d2d2d;cursor:pointer;">' + "`n"
$html += '        </div>' + "`n"
$html += '        <div class="admin-row">' + "`n"
$html += '          <label for="input-bg-color">Background colour</label>' + "`n"
$html += '          <input type="color" id="input-bg-color" value="#161616" style="width:56px;height:36px;padding:2px;border-radius:4px;border:1px solid #444;background:#2d2d2d;cursor:pointer;">' + "`n"
$html += '        </div>' + "`n"
$html += '      </div>' + "`n"
$html += '      <div class="admin-section">' + "`n"
$html += '        <h3>Game Settings</h3>' + "`n"
$html += '        <div class="admin-row">' + "`n"
$html += '          <label for="input-duration">Game duration (seconds)</label>' + "`n"
$html += '          <input type="number" id="input-duration" min="5" max="120" value="10">' + "`n"
$html += '        </div>' + "`n"
$html += '      </div>' + "`n"
$html += '      <div class="admin-section">' + "`n"
$html += '        <h3>Prize Tiers</h3>' + "`n"
$html += '        <div class="tier-header">' + "`n"
$html += '          <span>Tier Name</span>' + "`n"
$html += '          <span>Min Bees</span>' + "`n"
$html += '          <span>Gift / Prize</span>' + "`n"
$html += '          <span>Gift Image</span>' + "`n"
$html += '          <span></span>' + "`n"
$html += '        </div>' + "`n"
$html += '        <div id="tiers-list"></div>' + "`n"
$html += '        <button id="btn-add-tier" class="btn-add-tier">+ Add Tier</button>' + "`n"
$html += '      </div>' + "`n"
$html += '      <div class="admin-actions">' + "`n"
$html += '        <button class="btn-close-admin" id="btn-close-admin">Cancel</button>' + "`n"
$html += '        <button class="btn-save" id="btn-save-admin">Save Changes</button>' + "`n"
$html += '      </div>' + "`n"
$html += '    </div>' + "`n"
$html += '  </div>' + "`n"

# Firebase SDK — loaded from CDN so the bundled file stays self-hostable
# without needing Node/npm; the URLs below are the same compat bundles used in index.html.
$html += '  <!-- Firebase Realtime Database SDK -->' + "`n"
$html += '  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>' + "`n"
$html += '  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>' + "`n"
$html += "  <script>`n" + $allJs + "  </script>`n"
$html += '</body>' + "`n"
$html += '</html>'

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[IO.File]::WriteAllText((Join-Path $PSScriptRoot "IBM Bee Catcher.html"), $html, $utf8NoBom)
Write-Output "Done. Size: $([Math]::Round((Get-Item (Join-Path $PSScriptRoot 'IBM Bee Catcher.html')).Length / 1KB)) KB"

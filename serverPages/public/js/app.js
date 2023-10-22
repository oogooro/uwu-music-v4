// I have no idea what i am doing btw
const btnStatusPageElement = document.getElementById('statusBtn');
const btnLoggerPageElement = document.getElementById('loggerBtn');
const btnManagePageElement = document.getElementById('manageBtn');
const containerElement = document.getElementById('container');
const socket = io();
let updateStatusInterval = null;
let elementsForListeners = {
    btnRegisterGlobal: null,
    btnRegisterGuild: null,
    btnApply: null,
}
let listeners = {
    btnRegisterGlobal: null,
    btnRegisterGuild: null,
    btnApply: null,
}

let page = '';

axios.get('api/botInfo').then(res => {
    const { data } = res;

    const websiteTitle = document.querySelector('title');
    const title = document.querySelector('#botTag');
    const subtitle = document.querySelector('#subtitle');

    websiteTitle.innerText = `${data.user.username} on ${data.ENV}`;
    title.innerText = data.user.username;
    subtitle.innerText = `${data.user.tag} running on ${data.ENV.toUpperCase()}`;
});

const pageFunctions = {
    status: () => {
        function updateStatus() {
            const botStatusBoxElement = document.getElementById('botStatusBox');
            const botStatusInfoElement = document.getElementById('botStatusInfo');
        
            if (page !== 'status') {
                if (updateStatusInterval) clearInterval(updateStatusInterval);
                return;
            };
        
            axios.get('/api/botInfo').then(({ data }) => {
                if (data.ready) botStatusInfoElement.innerHTML = '<span class="status-ready bold">Ready</span>'
                else botStatusInfoElement.innerHTML = '<span class="status-not-ready bold">Not ready</span>'
        
                const content = `<span class='bold'>Komendy</span>
                    Wszystkie komendy: ${data.commands.allCommands.map(cmd => cmd.name).join(', ')}
            
                    <span class='bold'>Podsumowanie</span>
                    Ping ws: ${data.ping || '-1'}ms
                    Uptime: ${(data.uptime / 3600000).toFixed(2)}h
                    Serwery: ${data.guilds.length}`;
        
                botStatusBoxElement.innerHTML = content.split('\n').join('<br/>');
            }).catch(err => {
                console.log(err);
                botStatusBoxElement.innerHTML = 'Network error, check console';
            }).finally(() => {
                if (!updateStatusInterval) updateStatusInterval = setInterval(updateStatus, 10_000);
            });
        }

        updateStatus();
        socket.on('botReady', updateStatus);
    },
    logger: () => {
        function updateLogger() {
        }
        updateLogger();
        socket.on('logger', updateLogger);
    },
    manage: () => {
        const btnRegisterGuild = document.getElementById('btnRegisterGuild');
        const btnUnregisterGuild = document.getElementById('btnUnregisterGuild');
        const btnRegisterGlobal = document.getElementById('btnRegisterGlobal');
        const btnUnregisterGlobal = document.getElementById('btnUnregisterGlobal');
        const btnApply = document.getElementById('btnApply');

        function fillInputs() {
            axios.get('/api/botInfo/settings').then(({ data }) => {
                console.log(data);
                document.getElementById('online-mode').checked = data.online;
                document.getElementById('status').value = data.status.data[0].name;
                document.getElementById('activity').value = data.status.data[0].type;
                document.getElementById('status-visible').checked = data.status.visible;
            }).catch(console.error);
        }

        btnRegisterGlobal.addEventListener('click', (e) => {
            socket.emit('buttonClick', 'global');
        });

        btnRegisterGuild.addEventListener('click', (e) => {
            socket.emit('buttonClick', 'guild');
        });

        btnUnregisterGlobal.addEventListener('click', (e) => {
            socket.emit('buttonClick', 'unrglobal');
        });

        btnUnregisterGuild.addEventListener('click', (e) => {
            socket.emit('buttonClick', 'unrguild');
        });

        btnApply.addEventListener('click', (e) => {
            const data = {
                online: document.getElementById('online-mode').checked,
                status: {
                    visible: document.getElementById('status-visible').checked,
                    data: [{
                        name: document.getElementById('status').value,
                        type: parseInt(document.getElementById('activity').value),
                    }],
                },
            }

            console.log(data);
            socket.emit('manageChangeSettings', data);
        });

        fillInputs();
        socket.on('manageFeedback', fillInputs);
    },
}

const pageContents = {
    status: `
<p>Status: <span id="botStatusInfo"></span></p>
<div class="statusBox" id="botStatusBox"></div>
`,
    logger: `
<p>Logger:</p>
<div class="statusBox" id="botStatusBox"></div>
`,
    manage: `
    <p class="bold">Przyciski:</p>
    <p><input type="button" id="btnRegisterGuild" value="Zarejestruj komendy dla głównego serwera"></p>
    <p><input type="button" id="btnRegisterGlobal" value="Zarejestruj globalne komendy"></p>
    <p><input type="button" id="btnUnregisterGuild" value="Usuń komendy dla głównego serwera"></p>
    <p><input type="button" id="btnUnregisterGlobal" value="Usuń globalne komendy"></p>
    <p class="bold">Ustawienia:</p>
    <p><label for="online-mode">Online</label> <input type="checkbox" name="online-mode" id="online-mode"></p>
    <p>
        <label for="status">Status</label> <input type="text" name="status" id="status" autocomplete="off">
        <select name="activity" id="activity">
            <option value="0">Playing</option>
            <option value="2">Listening</option>
            <option value="3">Watching</option>
            <option value="4">Custom</option>
        </select>
        <label for="status-visible">Widoczny</label> <input type="checkbox" name="status-visible" id="status-visible">
    </p>
    <p><input type="submit" value="Zastosuj" id="btnApply"></p>
    <div style="display: none;" class="statusBox" id="botStatusBox"></div>
`,
}

function updateContent(pageName) {
    page = pageName;
    containerElement.innerHTML = pageContents[pageName];
    pageFunctions[pageName]();
}

updateContent('status');

btnStatusPageElement.addEventListener('click', () => updateContent('status'));
btnLoggerPageElement.addEventListener('click', () => updateContent('logger'));
btnManagePageElement.addEventListener('click', () => updateContent('manage'));

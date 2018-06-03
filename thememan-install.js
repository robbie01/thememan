(function() {
    async function wrap(f) {
        var originalPrompt = this.cli.prompt.innerHTML
        var originalOnenter = this.cli.onenter
        try {
            this.cli.prompt.innerHTML = ''
            this.cli.onenter = l => false
            var lastLog = $log('')
            await f({
                log: (...args) => {
                    var newLog = $log(...args)
                    newLog.parentElement.insertBefore(newLog, lastLog.nextSibling)
                    lastLog = newLog
                },
                arg: this.arg
            })
        } finally {
            this.cli.prompt.innerHTML = originalPrompt
            this.cli.onenter = originalOnenter
        }
    }

    const configFile = '.thememan/config.json'
    const configProxy = new Proxy({}, {
        "get": (_target, property) => JSON.parse(localStorage[configFile])[property],
        "set": (_target, property, value) => {
            try {
                localStorage[configFile] = JSON.stringify(Object.assign(JSON.parse(localStorage[configFile]), { [property]: value }))
                return true
            } catch (err) {
                return false
            }
        },
        'deleteProperty': (_target, property) => {
            const { [property]: _prop, ...newObj } = JSON.parse(localStorage[configFile])
            localStorage[configFile] = JSON.stringify(newObj)
            return true
        },
        'ownKeys': () => {
            return Reflect.ownKeys(JSON.parse(localStorage[configFile]))
        }
    })

    const cmds = {
        'load': (cli, name, url) => new Promise((res) => {
            let link = document.createElement('link')
            link.rel = 'stylesheet'
            link.type = 'text/css'
            link.href = url
            link.onload = () => {
                link.disabled = true
                _thememan_themes[name] = link;
                cli.log(`Theme ${name} loaded!`);
                res();
            }
            cli.log(`Loading theme ${name}...`)
            document.head.appendChild(link)
        }),
        'register': async (cli, name, url) => {
            configProxy[name] = url
            if (!_thememan_themes[name]) await cmds.load(cli, name, url)
        },
        'unregister': async (cli, name) => {
            delete configProxy[name]
        },
        'enable': async (cli, name) => {
            if (!(name in _thememan_themes) && name != 'none') {
                cli.log(`no such theme ${name} loaded`)
                return
            }
            for (let theme in _thememan_themes) {
                _thememan_themes[theme].disabled = true
            }
            if (name != 'none') _thememan_themes[name].disabled = false
            cli.log(`enabled theme ${name}!`)
        }
    }

    async function exec(cli) {
        const argv = cli.arg.arguments
        if (!(argv[0] in cmds)) {
            cli.log('invalid subcommand!')
            return
        }
        await cmds[argv[0]](cli, ...argv.slice(1))
    }

    le._apps.thememan = {
        terminal: true,
        exec: function() { wrap.call(this, exec) }
    }

    _thememan_themes = {}
    
    try {
        JSON.parse(localStorage[configFile])
    } catch (ex) {
        localStorage[configFile] = '{}'
    }
    (async function() { 
        for (let theme of Reflect.ownKeys(configProxy)) {
            cmds.load({ log: console.log }, theme, configProxy[theme])
        }
    })()
})()
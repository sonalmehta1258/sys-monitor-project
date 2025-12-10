// Fixed typo in port variable naming.
const express = require('express');
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files (index.html) from the current directory
app.use(express.static(__dirname));

// Enable CORS so the HTML file can talk to this server
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// Helper to execute shell commands
const runCommand = (cmd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(`Command failed: ${cmd}`);
                resolve(null); // Return null rather than crash
            } else {
                resolve(stdout.trim());
            }
        });
    });
};

app.get('/api/stats', async (req, res) => {
    try {
        // 1. CPU Usage (using top)
        const cpuRaw = await runCommand("top -bn1 | grep 'Cpu(s)'");
        let cpuUsage = 0;
        if(cpuRaw) {
            const parts = cpuRaw.split(',');
            const idlePart = parts.find(p => p.includes('id'));
            if(idlePart) {
                const idle = parseFloat(idlePart.trim().split(' ')[0]);
                cpuUsage = (100 - idle).toFixed(1);
            }
        }

        // 2. Memory (using free -b for bytes)
        const memRaw = await runCommand("free -b");
        let memory = { total: 0, used: 0, free: 0, available: 0 };
        if (memRaw) {
            const memLines = memRaw.split('\n');
            const memInfo = memLines[1].split(/\s+/);
            memory = {
                total: parseInt(memInfo[1]),
                used: parseInt(memInfo[2]),
                free: parseInt(memInfo[3]),
                available: parseInt(memInfo[6])
            };
        }

        // 3. Disk Usage (ROM)
        const diskRaw = await runCommand("df -h --output=source,size,used,avail,pcent,target | grep -v 'tmpfs' | grep -v 'devtmpfs'");
        let disk = [];
        if (diskRaw) {
            const diskLines = diskRaw.split('\n').slice(1);
            disk = diskLines.map(line => {
                const [fs, size, used, avail, use, mount] = line.trim().split(/\s+/);
                return { fs, size, used, avail, use, mount };
            }).filter(d => d.mount);
        }

        // 4. Network Logic
        const netRaw = await runCommand("ip -4 route get 8.8.8.8");
        let network = { iface: 'lo', ip: '127.0.0.1' };
        
        if (netRaw) {
            // Output example: "8.8.8.8 via 192.168.1.1 dev eth0 src 192.168.1.5 uid 1000"
            const parts = netRaw.split(/\s+/);
            const devIndex = parts.indexOf('dev');
            const srcIndex = parts.indexOf('src');
            
            if (devIndex !== -1 && srcIndex !== -1) {
                network = {
                    iface: parts[devIndex + 1],
                    ip: parts[srcIndex + 1]
                };
            }
        }

        // 5. Processes (ps aux)
        const procRaw = await runCommand("ps -eo pid,user,comm,%cpu,%mem --sort=-%cpu | head -n 7");
        let processes = [];
        if (procRaw) {
            const procLines = procRaw.split('\n').slice(1);
            processes = procLines.map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                    pid: parts[0],
                    user: parts[1],
                    cmd: parts[2],
                    cpu: parts[3],
                    mem: parts[4]
                };
            }).filter(p => p.pid);
        }

        // 6. Uptime & Hostname
        const uptimeRaw = await runCommand("uptime -p");
        const hostname = os.hostname();

        res.json({
            cpu: {
                usage: cpuUsage,
                cores: os.cpus().length
            },
            memory,
            disk,
            network,
            processes,
            system: {
                hostname,
                uptime: uptimeRaw || "unknown"
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`System Monitor Backend running on http://localhost:${PORT}`);
});

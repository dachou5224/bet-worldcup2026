# VPS 部署说明

目标域名：`bet.nice-ai.dev`

## 1. 上传项目

建议部署目录：

```bash
/var/www/guess_worldcup2026
```

## 2. 安装 Node.js

建议 Node 20+。

## 3. 配置环境变量

在部署目录创建 `.env`，至少包含：

```bash
ODDS_API_KEY=...
FOOTBALL_DATA_API_KEY=...
MARKET_DATA_MODE=real
LIVE_DATA_MODE=real
POLYMARKET_PUBLIC_ENABLED=false
PORT=3000
```

## 4. 启动应用

可直接运行：

```bash
node server.js
```

推荐使用 PM2：

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

健康检查接口：

```bash
curl http://127.0.0.1:3000/api/health
```

## 5. Nginx 反代

参考：

- [deploy/nginx.bet.nice-ai.dev.conf.example](deploy/nginx.bet.nice-ai.dev.conf.example)

把 `bet.nice-ai.dev` 反代到 `127.0.0.1:3000`。

推荐放置到：

```bash
/etc/nginx/sites-available/bet.nice-ai.dev
```

然后建立软链接：

```bash
sudo ln -s /etc/nginx/sites-available/bet.nice-ai.dev /etc/nginx/sites-enabled/bet.nice-ai.dev
sudo nginx -t
sudo systemctl reload nginx
```

## 6. HTTPS

Nginx 生效后，用 `certbot` 或你现有的证书流程为 `bet.nice-ai.dev` 申请 HTTPS。

如果使用 Certbot：

```bash
sudo certbot --nginx -d bet.nice-ai.dev
```

## 7. 上线后核验

```bash
curl -I http://127.0.0.1:3000
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/providers/status
```

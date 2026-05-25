# manu

移动端实时点菜系统 MVP。

技术栈：

- Vue 3
- TypeScript
- Vite
- Vue Router
- Supabase
- Element Plus

当前页面：

- `/order` 点菜页
- `/admin` 接单页

## 本地启动

1. 安装依赖

```sh
npm install
```

2. 配置环境变量  
编辑 [\.env.local](/C:/Users/Administrator/manu/.env.local:1)，填入你的 Supabase 项目地址和匿名 Key。

3. 启动开发环境

```sh
npm run dev
```

默认会监听 `0.0.0.0:5173`，同一局域网内的 iPhone 和 Android 可以直接访问开发机 IP。

## Supabase 初始化

在 Supabase SQL Editor 执行 [supabase/mvp_setup.sql](/C:/Users/Administrator/manu/supabase/mvp_setup.sql:1)。

这份 SQL 会完成：

- 创建 `orders` 表
- 开启 RLS
- 允许 `anon` 和 `authenticated` 读写 `orders`
- 将 `orders` 加入 realtime publication

## 局域网联调

1. 在 Supabase 执行初始化 SQL。
2. 在 [\.env.local](/C:/Users/Administrator/manu/.env.local:1) 填入真实环境变量。
3. 运行 `npm run dev`。
4. iPhone 打开 `http://你的电脑IP:5173/order`。
5. Android 打开 `http://你的电脑IP:5173/admin`。
6. 在接单页先点一次“开启声音提醒”。
7. 在点菜页下单，确认新订单实时出现并可完成。

## 公网部署

当前仓库已经补了 [vercel.json](/C:/Users/Administrator/manu/vercel.json:1)，用于处理 Vue Router 的 SPA 刷新回退，这样公网访问 `/order` 和 `/admin` 时不会直接 404。

推荐流程：

1. 把项目推到 GitHub。
2. 在 Vercel 导入该仓库。
3. 构建设置保持默认即可：
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. 在 Vercel 项目环境变量中配置：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. 点击 Deploy。

部署完成后：

- 点菜页：`https://你的域名/order`
- 接单页：`https://你的域名/admin`

如果需要自定义域名，可以在 Vercel 的 Domains 页面绑定。

## 验证命令

```sh
npm run type-check
npm run build-only
```

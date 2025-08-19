# 🚀 游戏部署指南

## 方法一：GitHub Pages（推荐）

### 1. 创建GitHub仓库
1. 登录 [GitHub](https://github.com)
2. 点击右上角 "+" → "New repository"
3. 仓库名填写：`snake-tower-defense`
4. 选择 "Public"
5. 点击 "Create repository"

### 2. 上传代码
```bash
# 添加远程仓库（替换 your-username 为你的GitHub用户名）
git remote add origin https://github.com/your-username/snake-tower-defense.git

# 推送代码
git branch -M main
git push -u origin main
```

### 3. 启用GitHub Pages
1. 进入仓库页面
2. 点击 "Settings" 标签
3. 左侧菜单找到 "Pages"
4. Source 选择 "Deploy from a branch"
5. Branch 选择 "main"，文件夹选择 "/ (root)"
6. 点击 "Save"

### 4. 获取游戏链接
几分钟后，你的游戏将在以下地址可用：
`https://your-username.github.io/snake-tower-defense/`

## 方法二：Netlify（备选）

1. 访问 [Netlify](https://netlify.com)
2. 注册/登录账号
3. 点击 "New site from Git"
4. 连接GitHub仓库
5. 部署设置选择默认
6. 点击 "Deploy site"

## 方法三：Vercel（备选）

1. 访问 [Vercel](https://vercel.com)
2. 注册/登录账号
3. 点击 "New Project"
4. 导入GitHub仓库
5. 点击 "Deploy"

## 📱 分享给朋友

部署完成后，将游戏链接发送给朋友即可！

### 微信分享示例：
```
🎮 我制作了一个超好玩的塔防游戏！

🐍 蛇形塔防 - 肉鸽游戏
- 5个不同的恶魔Boss
- 宝箱升级系统
- 恶魔角蛇头设计

🎯 游戏链接：[你的游戏链接]

快来挑战吧！看看你能打到第几关！🔥
```

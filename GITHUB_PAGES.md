# GitHub Pages 发布步骤

这个项目是纯静态网页，可以直接用 GitHub Pages 发布。

## 方式一：网页上传

1. 打开 https://github.com/new
2. 新建一个公开仓库，例如 `gesture-particle-demo`
3. 上传这些文件：
   - `index.html`
   - `src/main.js`
   - `src/styles.css`
   - `.nojekyll`
   - `README.txt`
4. 进入仓库 `Settings` -> `Pages`
5. 在 `Build and deployment` 中选择：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. 保存后等待 1-3 分钟。

最终访问地址通常是：

```text
https://你的用户名.github.io/仓库名/
```

## 方式二：命令行上传

```powershell
git init
git add index.html src .nojekyll README.txt
git commit -m "Deploy gesture particle demo"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

然后到仓库 `Settings` -> `Pages` 开启 GitHub Pages。

## 注意

- GitHub Pages 自带 HTTPS，摄像头权限可以正常弹出。
- 首次打开需要联网加载 Three.js 和 MediaPipe。
- 如果摄像头打不开，检查浏览器权限，关闭微信、会议软件等可能占用摄像头的程序。

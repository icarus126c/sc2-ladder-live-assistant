# 明日方舟 · 罗德岛终端

参考仓库：[mashirozx/arknights-ui](https://github.com/mashirozx/arknights-ui)，固定版本 `8fb68d35992467c0cca9de953c5bd6227c316b97`。

这套内置主题取其舰船背景、陈的立绘、罗德岛标识，以及黑白面板、直角边线和黄色强调色。直播标题、战绩、MMR 和键盘仍由本程序实时显示，游戏区域保持透明。按键助手使用原立绘做轻微位移反馈，不将静态立绘称为重新绘制的敲键盘动作。

| 本地素材 | 上游来源与处理 |
| --- | --- |
| `public/assets/arknights-chen-v1.png` | `img/char_010_chen_2b_merged.png`，无视觉改动 |
| `public/assets/arknights-logo-v1.png` | `img/UI_HOME.png` 中 `.level-logo` 对应的标识裁剪 |
| `public/assets/arknights-background-v1.png` | `img/UI_HOME_FRONT_BKG.png`，等比裁切、降饱和、左侧压暗 |
| `public/assets/arknights-cover-v1.png` | 上述三项的风格库封面合成 |

上游代码的 MIT 许可见 [ARKNIGHTS-UI-LICENSE.txt](ARKNIGHTS-UI-LICENSE.txt)。上游明确说明游戏贴图来自游戏资源，仅供学习、请勿商用。明日方舟角色、标识及游戏美术权利属于各自权利人，不包含在本项目代码的 MIT 授权中。

重建素材：在开发环境安装 Pillow，检出上述固定版本后运行 `python scripts/build-arknights-assets.py --source <上游目录>`。运行助手不需要 Pillow，也不会访问上游网页。

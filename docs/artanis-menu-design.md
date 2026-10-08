# Q 版大主教与原神菜单工具

制作方式：内置 ImageGen，透明背景。四份素材是按角色／截图参考重新生成的图像，不是官方原文件；生成后的 PNG 原样复制，动画与裁切在网页内完成。

## 保存的素材

| 文件（项目内） | 用途 |
| --- | --- |
| `public/assets/artanis-keys-v1.png` | Q 版大主教待机、左手、右手三格动作，2172 × 724 |
| `public/assets/artanis-rally-v1.png` | 单独集结动作，1280 × 1280 |
| `public/assets/resource-genshin-menu-v1.png` | 星芒、背包、角色三枚菜单图标，2172 × 724 |
| `public/assets/paimon-menu-v1.png` | 可独立开启的派蒙菜单图标，1280 × 1280 |

## 使用

- 按键小助手选择“大主教 · Q 版阿塔尼斯”，默认侧后方单键盘。点击“录制触发键”，按一个键，再应用。默认未绑定；Esc 取消录制。按住时保持集结，松开后默认停留 1000 毫秒，可调 300–3000 毫秒。清除绑定即关闭此动作。演示只改变预览。平面键盘不显示人物或漫画框。
- 触发遵守所选响应范围（默认仅星际 2 前台，可选全局）和游戏聊天保护；选中的触发键即使关闭了对应按键展示类别仍能触发，其余隐藏类别继续过滤。改键不重放正在按住的旧键。角色换装保留个人触发键。
- 资源模板选择“原神 · 菜单图标”。星芒、背包、角色的红色感叹号各自开关。派蒙及其感叹号独立开关、默认关闭，可调整位置和大小。仅开启派蒙时不替换右侧图标；两者仍服从场景资源图层和总开关。红色徽章仅装饰，不代表读取到游戏通知。
- 星灵控制台的“丰富装饰”填充单位面板左右侧空闲区域并替换原肖像；两个人物属于同一星灵主题。小地图、技能、控制编队和中间血量／攻防区域保持固定屏幕坐标镂空。“仅边沿”完整保留原单位面板与肖像。丰富款针对提供的 16:9 星灵单单位 HUD 标定；多单位选择、不同种族或 UI 比例需要先核对预览，必要时切回仅边沿。
- 一键换装的星灵主题现在包括 Q 版大主教。资源款和触发键仍保持个人选择；保存混搭会保存控制台装饰范围。

## 验证

182 项回归测试通过。22 组浏览器实际 SVG 栅格检查覆盖五种资源图标（红点、派蒙、最大图标、偏移）以及两种星灵控制台的丰富／边沿模式和极端位置缩放。规定的保护窗口内无不透明像素。浏览器界面已验证自定义键录制、差分演示和各开关；本次测试绑定没有保存。

## 完整生成提示词

### artanis-keys-v1.png

```text
Use case: stylized-concept. Input image is identity reference for Artanis only; create a NEW chibi variant, do not overwrite reference. Asset type: transparent 3-pose character sprite sheet for a livestream keyboard assistant. Exactly three equal square cells in one wide horizontal 3:1 canvas. All cells show same mildly chibi StarCraft II Hierarch Artanis, recognizable elongated mouthless gray Protoss face, bright blue eyes, royal gold ivory armor, swept crown and shoulder pauldrons, dark blue cloth and nerve cords. Cute but dignified, big head, compact body, about 2.5 heads tall, detailed polished stylized 3D game art. Camera above and slightly behind his RIGHT shoulder, reveals LEFT-facing side profile; Artanis looks diagonally down-left toward a single keyboard that will be drawn by code outside the asset. No keyboard in image. Both gauntlets near his waist directed down-left, forearms have clear room. LEFT cell idle hands poised. MIDDLE cell left arm tapping down. RIGHT cell right arm tapping down. Same position, scale and camera in every cell. Each silhouette completely inside its cell with 10% clear margins including head nerve cords hands, no overlap. Truly transparent alpha background, no floor, no backdrop, no lettering, no borders, no additional characters. Gold ivory cyan navy coherent with the reference. Cartoon charm without human face or anime cat ears.
```

### resource-genshin-menu-v1.png

```text
Use case: precise-object-edit. Input screenshot is the visual reference. Create a clean new transparent sprite sheet of ONLY the rightmost THREE white Genshin Impact menu icons from the reference: LEFT the four-point wish STAR icon (not the flame emblem), MIDDLE the small BACKPACK icon, RIGHT the white side-profile CHARACTER HEAD with sweeping hair. Same silhouette and design as screenshot, bright white with subtle pale blue-gray edge shadow. Exactly three equally sized square cells in a single wide horizontal 3:1 canvas, icons centered at 1/6, 1/2, 5/6 width with ample clear separation. Use crisp flat game UI shapes, no redesign and no 3D rendering. Each icon fills 75% of its cell, consistent visual weight and 32px legibility. Remove ALL screenshot background, landscape, latency, green text, badges and red exclamation circles. Output true transparent alpha. No text, no grid, no fourth emblem. Complete silhouettes, no cropping.
```

### paimon-menu-v1.png

```text
Use case: background-extraction. Input screenshot is the target icon reference. Extract/reconstruct ONLY the Genshin Paimon menu emblem from the second screenshot as a clean white flat UI icon with her exact side-profile hair silhouette, dark blue star-shaped hair ornament, small gold floating crown/halo, dark blue scarf swoosh. Preserve the screenshot's emblem design, no redesign, no full-bodied character. Center emblem on square canvas with 10% clear margin. Remove red exclamation badge completely; remove the entire photograph/game scenery background. Truly transparent alpha around and within the icon, crisp white silhouettes with navy details and golden crown. No extra text, no badges, no shadows outside icon, no frame.
```

### artanis-rally-v1.png

```text
Use case: stylized-concept. Asset type: standalone transparent action variant for a livestream keyboard assistant. The input image is the exact identity and style reference: keep this same mildly chibi Artanis, elongated mouthless gray Protoss face, luminous blue eyes, gold ivory armor and crown, navy cloth and blue nerve cords, same proportions and polished stylized game art. Create ONE complete character, not a sheet. Camera above and slightly behind his right shoulder with his left-facing side profile visible. Change the pose to an unmistakable commanding rally gesture: one gauntleted arm raised and pointing firmly forward/up-left to gather his army, the other arm at his waist. Energetic confident commanding expression, cute dignified Hierarch. All head, hands and nerve cords inside canvas with 10% margins. Square canvas, true transparent alpha, no keyboard, no floor, no background, no text, no comic bubble (we add exact Chinese lettering in UI), no extra character.
```


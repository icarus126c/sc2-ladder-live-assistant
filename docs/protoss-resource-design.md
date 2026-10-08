# 星灵主题与资源模板素材

2026-10-08。使用内置图像生成工具（built-in image_gen），未使用 API / CLI。全部 PNG 保留真实透明通道；控制台装甲和舞台几何由代码绘制。

## 已保存的素材

| 用途 | 项目路径 | 尺寸 |
| --- | --- | --- |
| 大主教 | `public/assets/artanis-character-v1.png` | 1254×1254 |
| 狂热者 | `public/assets/zealot-character-v1.png` | 1145×1374 |
| 资源图标 genshin | `public/assets/resource-genshin-v1.png` | 2172×724，横排三格 |
| 资源图标 zealot | `public/assets/resource-zealot-v1.png` | 2172×724，横排三格 |
| 资源图标 naiwa | `public/assets/resource-naiwa-v1.png` | 2172×724，横排三格 |
| 资源图标 vesna | `public/assets/resource-vesna-v1.png` | 2172×724，横排三格 |

## 使用与校准

一键换装只有一个“星灵 · 大主教与狂热者”入口，等待、载入、暂离同时出现两个角色。游戏控制台保留大主教与狂热者两种装甲饰章变化。金白装甲、古金材质和蓝色灵能贯穿全部画面。

资源模板在工具库和侧栏有独立入口，默认关闭。矿物、瓦斯、人口数字由原游戏画面透出，工具只盖原图标；无需游戏资源接口、OCR 或重复渲染数字。原神道具分别是摩拉、原石、纠缠之缘；健身款是静态的三个不同姿势，不会根据资源数量自动变换动作。薇斯纳是按风元素灵剑意象重绘的主题图标，并非官方素材提取。参考：[HoYoWiki 薇斯纳](https://wiki.hoyolab.com/m/genshin/entry/11661?lang=zh-tw)。

默认按1920×1080、16:9原版资源栏校准，图标覆盖区分别从X=1484、1610、1738开始，Y=9，尺寸34×42。图标在自己的覆盖区内缩放，三个数字窗口和右上按钮固定镂空。不同分辨率、UI缩放或布局应先在完整预览和放大预览中核对，再微调位置。图标透明度只影响新素材，遮住原图标的底色保持不透明。

完整输出 `/output` 已包含资源模板；独立透明来源为 `/resource-template`，同样使用1920×1080。默认仅游戏场景显示，也可以在画面自定义中按场景调整。空白场景始终隐藏工具。资源模板不参与一键换装，保留自己的独立选择。

控制台信息保护针对16:9星灵原版HUD。14种浏览器栅格渲染组合（资源四款默认与放大、控制台两款默认与极端变换）均验证保护窗口内零不透明像素；176项回归测试通过。

## 最终生成提示词

### artanis

```text
Use case: stylized-concept. Asset type: transparent character illustration for a StarCraft II livestream console theme and waiting/break screens. Primary request: a magnificent authentic StarCraft II Artanis, the Protoss Hierarch, recognizable game character. Single waist-up hero on truly transparent alpha background, centered, generous clear margin, complete head and broad shoulder armor inside canvas. Tall alien Protoss face with NO human mouth, glowing cyan eyes, distinctive long nerve cords and blue ceremonial cloth, pale gray alien skin, imposing Khala-era gold and ivory armor with large elegant swept shoulder plates, illuminated azure crystal cores, classic StarCraft II cinematic game render quality. Front three-quarter angle, dignified and calm, one gauntlet at his chest, no keyboard and no companions. Cohesive palette antique champagne gold, ivory enamel, deep indigo navy, focused cyan psionic light. Strong readable silhouette, precise polished metal bevels and restrained edge emission, detailed but uncluttered, premium Blizzard-style sci-fi fantasy concept art, realistic stylized 3D material painting. Lighting warm overhead rim plus cyan core glow. Intended to remain readable as a portrait medallion and a larger 650px scene character. No text, no logo, no border, no scenery, no floor, no floating weapon crossing canvas, no watermark, no human face, no anime cat features. Portrait-ish or square canvas, never crop the shoulders or nerve cords.
```

### zealot

```text
Use case: stylized-concept. Asset type: transparent character illustration for a StarCraft II Protoss Zealot livestream console theme and waiting/break screens. Primary request: one recognizable StarCraft II Protoss Zealot warrior, the classic '叉子', hero waist-up portrait, front three-quarter pose, proud and battle ready, both armored forearms visible with two compact luminous azure psionic wrist blades angled downward away from his head. Single alien Protoss warrior, long elongated pale gray face, NO human mouth, intense cyan glowing eyes, long swept-back nerve cords, classic angular gold/ivory Protoss shoulder and forearm armor with blue psionic crystals, blue cloth waist accents. Match premium cinematic game material style: realistic stylized 3D painting, sculpted metallic bevels, detailed worn antique champagne gold, ivory enamel, midnight navy shadows, restrained concentrated electric-cyan energy. The warrior's equipment simpler and sharper than the ceremonial Hierarch Artanis, no huge crown or hierarchy helmet, assertive forward stance. Centered complete bust silhouette, plenty of clear margin around all extremities, wrists and blades fully inside image. Truly transparent alpha background, no backdrop, no floor, no text, no logos, no border, no watermark, no other figures, no human face, no anime. Square or portrait canvas. Materials beautifully detailed and coherent with StarCraft II golden Protoss in-game console panels. Small blades stay within overall shoulder width for clean placement in a livestream scene.
```

### resource-genshin

```text
Use case: stylized-concept. Asset type: three game inventory icons in a single horizontal transparent sprite sheet for a tiny livestream HUD. Wide 3:1 canvas divided invisibly into exactly three equal square cells. Each icon centered precisely at 1/6, 1/2 and 5/6 of canvas width, same visual scale, occupies 80% of its cell, generous transparent separation. LEFT: recognizable Genshin Impact Mora, one polished gold round coin with the canonical curved triangular knot motif engraved, three-quarter view. MIDDLE: recognizable Genshin Primogem, four-point faceted white light-blue crystal star with slight pink rainbow reflection. RIGHT: recognizable Genshin Intertwined Fate, pearlescent pink-purple and blue celestial orb, elegant crossing gold celestial ribbons. Beautiful authentic Genshin inventory art, crisp outlines, softly painted volumetric highlights, gold light blue pink palette. Truly transparent alpha background, no scenery no text no labels no grid no numbers no badges no additional objects. All three are individual isolated icons completely contained in their cells. They must remain legible at 32px.
```

### resource-zealot

```text
Use case: stylized-concept. Asset type: three playful StarCraft II Protoss Zealot bodybuilding icon portraits, one horizontal transparent sprite sheet. Wide 3:1 canvas invisibly divided into exactly three equal square cells, centers at 1/6, 1/2, 5/6 of width, each figure completely inside its own cell and fills 82%, no overlap, transparent spacing. All three depict the SAME recognizable Protoss Zealot, alien pale gray elongated face with no mouth, cyan eyes, swept nerve cords, classic gold ivory StarCraft armor and compact cyan psionic wrist crystals, comically huge muscular armored arms. LEFT pose: frontal double biceps flex with both elbows raised. MIDDLE pose: side-chest bodybuilding pose, shoulder profile, clasping hands to flex chest. RIGHT pose: most-muscular pose, both fists downward in front of abdomen, massive shoulder flex. Three distinct clearly readable poses, heroic yet funny, waist-up, premium stylized 3D game illustration, clean silhouette, sculpted gold armor, navy shadows, cyan energy. Small 32px readable icons not posters. True transparent alpha background, no text no border no labels no grid no scenery no logos, never crop heads or hands.
```

### resource-naiwa

```text
Use case: stylized-concept. Asset type: three absurd cute eerie long-bodied Nailong meme dragon bodybuilding icons in one horizontal transparent sprite sheet. Wide 3:1 canvas invisibly divided into exactly three equal square cells, centers at 1/6, 1/2, 5/6 width. Each complete figure fits entirely within own square cell, fills 80%, no overlap, transparent gaps. Same yellow Chinese internet meme Nailong dragon in all cells: rounded slightly vacant smiling frog-dragon face, tiny black eyes, squat snout, small horns, absurdly LONG humanlike torso and neck, thick muscular arms, smooth rubbery yellow skin, small cream belly, funny uncanny but friendly. LEFT: double biceps flex, raised elbows. MIDDLE: side chest pose clasping hands across abdomen and turning sideways. RIGHT: powerful most-muscular pose leaning forward and fists downward, enormous rounded shoulders. Full torso portraits, distinguishable fitness poses, polished soft 3D toy illustration, buttery yellow orange shadows, very clean bold silhouette readable at 32px. True transparent alpha background, no scenery no text no grid no labels no clothes with logos, no dumbbells hiding the pose, all hands and head fully visible.
```

### resource-vesna

```text
Use case: stylized-concept. Asset type: three elegant ethereal spirit sword icons inspired by Genshin Impact Vesna's Anemo summoned spirit swords, single horizontal transparent sprite sheet. Wide 3:1 canvas invisibly divided into exactly three equal square cells, icons centers at 1/6, 1/2, 5/6 of width, each fills 80% cell without overlapping. LEFT: one slender luminous cyan jade wind spirit sword, diagonally ascending, white faceted blade and delicate gold guard, wing-shaped wind filigree. MIDDLE: two crossed pearlescent mint wind spirit swords with little crystalline teal diamond, golden guard and subtle pale pink accent. RIGHT: three compact floating spirit swords arranged in a fan, wispy translucent featherlike Anemo wings, cyan-white cores, gold hilt details. Unified original themed icon art of Vesna's teal white gold magical military fairy aesthetic, Genshin inventory illustration quality, clear crisp edged shapes, restrained glow that stays in each cell. True transparent alpha background. No character no text no logo no labels no grid no scenery no particles outside cells. Must be visually readable at tiny 32px.
```



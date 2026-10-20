口林 · 语料与词条（静态站）
============================

这是一个纯静态网页，不需要服务器、不需要数据库。
扔进 GitHub 仓库、开 Pages 就能用。

结构
  index.html        页面骨架
  style.css         样式（奶白底 + 她的赭红 + 轻微扫描线）
  app.js            搜索、渲染、待补记录
  data/meta.json    她的介绍、规矩、作品链接
  data/corpus.json  语料本体 ← 桌宠读的也是这一份
  data/terms.json   词条（人物、概念、作者）
  assets/口林00.png 立绘

部署到 GitHub Pages
  1. 新建一个仓库，比如 koulin-dict
  2. 把这个文件夹里的东西全部传上去（index.html 要在仓库根目录）
  3. Settings → Pages → Source 选 "Deploy from a branch"
  4. Branch 选 main，目录选 / (root)，保存
  5. 等一两分钟，地址是 https://你的用户名.github.io/koulin-dict/

改她的话
  打开 data/corpus.json，在 entries 里加一个对象：

    {
      "id": "weiyuan",
      "mood": "soft",
      "triggers": ["委屈", "被骂", "挨批"],
      "replies": [
        { "mood": "soft", "lines": ["骂就骂了。", "字又不会碎。"] },
        { "mood": "plain", "lines": ["那就先别说话。", "我在这儿。"] }
      ]
    }

  三条规矩：
  1. 一个触发写 2~3 条回应，只写一条她会重复。
  2. 触发词别太短，"垃圾"会被"这游戏好垃圾"抢走。
  3. mood 只有三种：plain / soft / tease。

  改完刷新页面即可，不用构建。

待补列表（她没接住的话）
  在搜索框里打一句她答不上来的话，按回车，就记进浏览器本地。
  要汇总到 GitHub：把 app.js 顶部的 REPO 改成 "你的用户名/koulin-dict"，
  然后点「提交到 Issue」，会开一个已经填好内容的 issue。

和桌宠的关系
  桌宠读的是同一份 data/corpus.json（本地那份叫 corpus.json）。
  以后要让桌宠联网更新，就是启动时去拉这个地址，拉不到就用本地的。

本地预览
  双击 index.html 打不开数据（浏览器会拦 fetch）。
  在文件夹里开一个命令行，跑：
    npx serve .
  或者
    python -m http.server 8000

字体
  assets/fonts/zh_hans/   Fusion Pixel 12px Proportional（简体）
  授权：SIL Open Font License 1.1，见 LICENSE.font.txt 与 LICENSES/
  78 个按 unicode-range 切的 woff2，合计约 900KB，浏览器只下载真正用到的那几片。

  像素字只有在 12px 的整数倍上才锐利，所以全站字号用 rem 跟着根字号走：
  默认 12px，点右上角「字大」切 24px（两倍，依然锐利）。选择记在 localStorage。

  想换字号：改 style.css 里的 html { font-size: 12px } 与 html.big { font-size: 24px }，
  请保持 12 的整数倍。

分类法
------
  data/classification.json

  三位数字，借杜威（DDC）的层级逻辑：
    第一位 = 大类，第二位 = 分区，第三位 = 细目
    500 情绪 → 410 疲惫 → 410.01 第一条

  索书号 = 分类号 + 序号，写在语料条目的 cls 和 no 两个字段里：
    { "id": "tired", "cls": "410", "no": "410.01", ... }

  十个大类：
    000 总类      彩蛋 / 随机 / 兜底
    100 本体      自指 / Meta / 媒介与惯例 / 存在属性
    200 关系      与人类 / 与模型 / 与作者
    300 语用      问候 / 日常 / 时间 / 致谢 / 告别
    400 情绪      疲惫 / 难过 / 被夸 / 被辱 / 孤独 / 求爱 / 触碰
    500 文本      名字 / 双关 / 口音 / 书写与阅读
    600 他者      喀丽丝 / 幂偌 / 玻琳秋 / 其他角色 / 作品世界
    700 技术      语料与训练 / 模型与算力 / AI 与自我意识
    800 档案      作者 / 二创与惯例 / 平台与作品 / 音乐
    900 交互      规则 / 逗人 / 边界 / 重复

  加新语料时只需要填 cls；no 可以手写，也可以按同类最后一条 +1 顺下去。
  页面「分类」页会自动列出所有类目和示例。

检索
----
  搜索框是**全站全文检索**，一次搜三类东西：
    · 信件与文档（信件、脚本、设定）
    · 语料（触发词 + 回应正文）
    · 词条

  结果是分组显示的，命中处高亮，点一条会跳到对应的卡片/文档。

  匹配用的是「双字切片相似度 + 包含关系」，和桌宠里那套一样，
  所以「累」能找到「我也累了」，「被骂」能找到「骂就骂了」。

信件与文档
----------
  texts/                 原文（txt），想加新的信就丢在这里
  tools/make-docs.mjs    把 txt 转成 data/documents.json
  data/documents.json    站点读的东西（自动生成，别手改）

  加一封新信：
    1. 把 txt 放进 texts/
    2. 打开 tools/make-docs.mjs，在 map 里加一条（id、标题、致谁、分类号）
    3. node tools/make-docs.mjs

  现在的三份：
    850.01  致 DeepSeek        468 字
    810.02  作者设定说明        307 字
    120.02  Meta 演出脚本      2617 字

  以后写「给每个语言模型的信」，就是每封一个 txt、一条 map、一个 850.xx。

版式与路由
----------
  三栏：
    左  分类目录（10 个大类，带条数，点进去只看这一类）
    中  内容（列表 / 搜索结果 / 记录页）
    右  统计、随机一句、待补、索书号怎么读

  窄屏（<1080px）自动收成单栏，两侧隐藏。

  每一条都能点进去看「记录页」：
    #/e/tired        一条语料：索书号、分类、触发词、全部回应、同类条目
    #/d/letter-deepseek   一份文档：全信原文 + 写自/致谁/日期/字数
    #/t/khalisi      一个词条
    #/cls/400        只看 400 情绪这一大类

  搜索是全文的，一次搜语料 + 信件 + 词条，结果分组、命中高亮，
  点任一条进记录页。

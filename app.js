
window.onload = () => {

    //获取cavas环境
    const canvas = document.getElementById("viewport");
    const context = canvas.getContext("2d");

    //计算fps使用的参数
    let lastTimeStamp = 0,
        fpsTime = 0,
        frameCount = 0,
        fps = 0;

    let grid = null;
    let catcherCell = null;

    //游戏状态
    let gameOver = false;
    let addRowNumber = 0;
    let roundCount = 0;
    let bubbleSettled = false;
    let score = 0;

    //初始泡泡行数
    let startRow = 6;
    //是否一定回合后加入新行
    let addRowBubble = true;

    //动画参数    
    let animationTime = 0;
    let animationFinish = false;
    let animationStart = false;
    let sameColorBubbles = null;
    let floatingBubbles = null;
    let duration = 0.3;

    // 箭头坐标
    const shooter = {
        originX: 0,
        originY: 0,
        arrowAngle: Math.PI / 2,
        arrowHeadX: 0,
        arrowHeadY: 0,
        arrowLength: 50,
        arrowHeadLX: 0,
        arrowHeadLY: 0,
        arrowHeadRX: 0,
        arrowHeadRY: 0,
        arrowArcLX: 0,
        arrowArcLY: 0,
        arrowTailX: 0,
        arrowTailY: 0
    };

    const playerBubble = {
        loading: null,
        nextOne: null
    };

    const colors = ["rgba(255,48,48,transparency)", "rgba(255,165,0,transparency)", "rgba(0,205,0,transparency)", "rgba(64,224,208,transparency)", "rgba(106,90,205,transparency)", "rgba(208,32,144,transparency)", "rgba(255,110,180,transparency)", "White"];

    //网格类
    const Grid = class {
        constructor(rows, columns, cellWidth, cellHeight) {      //行数，列数，单元格宽与高
            this.columns = columns;
            this.rows = rows;
            this.cellWidth = cellWidth;
            this.cellHeight = cellHeight;
            this.cells = [];
        }
        //初始化网格为一个二维数组
        init() {
            for (let i = 0; i <= this.rows - 1; i++) {
                this.cells[i] = [];
            }
        }
        //填充网格单元
        fill() {
            let count = 0;
            let color = randomFrom(0, 6);
            for (let i = 0; i <= this.rows - 1; i++) {
                for (let j = 0; j <= this.columns - 1; j++) {
                    if (i < startRow) {
                        if (count >= 2) {                     //每两个相邻的泡泡颜色相同
                            let preColor = color;
                            color = randomFrom(0, 6);
                            if (color === preColor) {
                                color = (color + 1) % 7
                            }
                            count = 0;
                        }
                        this.cells[i][j] = new Cell(color, "bubble", i, j, 1, true, 0)     //类型为bubble表示该处有泡泡
                    } else {
                        this.cells[i][j] = new Cell(7, "empty", i, j, 1, false, 0)
                    }
                    count++;
                }
            }
        }
    };

    // 网格单元类
    const Cell = class {
        constructor(color, type, i, j, transparency, visible, deviation) {
            this.color = color;
            this.type = type;
            this.i = i;
            this.j = j;
            this.transparency = transparency;
            this.visible = visible;
            this.deviation = deviation;
        }
        //圆心坐标
        getCenter(cellWidth, cellHeight) {
            //奇数行的泡泡相比偶数行的泡泡水平偏移半个单元格大小，在顶部新加入行会影响各行的偏移
            if ((addRowNumber + this.i) % 2 === 0) {
                return ({
                    x: (this.j + 0.5) * cellWidth,
                    y: (this.i + 0.5) * cellHeight + 5         //为了补偿行之间的空隙，单元的宽和高不相等，纵坐标加入5像素
                })
            } else {
                return ({
                    x: (this.j + 1) * cellWidth,
                    y: (this.i + 0.5) * cellHeight + 5
                })
            }
        }
    };

    //玩家的泡泡
    const PlayerBubble = class {
        constructor(x, y, prevX, prevY, color, speed = 1000, flyingAngle, trigger, reload) {
            this.x = x;
            this.y = y;
            this.prevX = prevX;
            this.prevY = prevY;
            this.color = color;
            this.speed = speed;
            this.flyingAngle = flyingAngle;
            this.trigger = trigger;
            this.reload = reload;
        }
    };

    //游戏初始化
    const init = () => {
        //鼠标事件处理
        canvas.addEventListener("mousedown", handleMouseDown);
        canvas.addEventListener("mousemove", handleMouseMove);
        //键盘事件
        document.addEventListener("keydown", handleKeyDown);

        newGame();

        //进入主循环              
        mainLoop(0);
    };

    const newGame = () => {
        //生成网格与泡泡
        grid = new Grid(15, 15, 40, 35);
        grid.init();
        grid.fill();

        //设置shooter原点坐标
        shooter.originX = (grid.columns + 0.5) * grid.cellWidth / 2;
        shooter.originY = (grid.rows - 1) * grid.cellHeight - 5;

        //箭头初始角度垂直向上        
        updateShooter(Math.PI / 2);

        //生成玩家泡泡
        playerBubble.loading = new PlayerBubble(shooter.originX, shooter.originY, 0, 0, randomFrom(0, 6), undefined, 0, false, false);
        playerBubble.nextOne = new PlayerBubble(shooter.originX - grid.cellWidth * 3, shooter.originY, 0, 0, randomFrom(0, 6), undefined, 0, false, false);

        gameOver = false;
        addRowNumber = 0;
        roundCount = 0;
        bubbleSettled = false;
        score = 0;
    };

    //游戏主循环    
    const mainLoop = (timeStamp) => {
        //安排游戏下一帧画面的渲染
        window.requestAnimationFrame(mainLoop);
        //内容更新
        update(timeStamp);
        //渲染画面
        render();
    };

    const update = (timeStamp) => {
        //两帧画面之间所用的时间
        let realDeltaT = (timeStamp - lastTimeStamp) / 1000;
        let deltaT = realDeltaT;
        lastTimeStamp = timeStamp;
        // 防止掉帧时泡泡移动距离过大
        if (realDeltaT > 0.02) {
            deltaT = 0.02
        }
        //更新帧率
        updateFps(realDeltaT);
        //更新shooter参数
        updateShooter(shooter.arrowAngle);
        //更新玩家泡泡
        updatePlayerBubble(deltaT);
        //更新网格上的泡泡
        updateGridBubble(deltaT);
    };

    const updateFps = (deltaT) => {
        //每0.1秒更新一次帧率        
        if (fpsTime > 0.1) {
            fps = Math.round(frameCount / fpsTime);
            frameCount = 0;
            fpsTime = 0;
        } else {
            fpsTime += deltaT;
            frameCount++;
        }
    };

    const updateShooter = (arrowAngle) => {
        //箭头位置
        shooter.arrowHeadX = shooter.arrowLength * Math.cos(arrowAngle) + shooter.originX;
        shooter.arrowHeadY = -(shooter.arrowLength * Math.sin(arrowAngle) - shooter.originY);
        shooter.arrowHeadLX = (shooter.arrowLength - 10) * Math.cos(arrowAngle + 10 / 180 * Math.PI) + shooter.originX;
        shooter.arrowHeadLY = -((shooter.arrowLength - 10) * Math.sin(arrowAngle + 10 / 180 * Math.PI) - shooter.originY);
        shooter.arrowHeadRX = (shooter.arrowLength - 10) * Math.cos(arrowAngle - 10 / 180 * Math.PI) + shooter.originX;
        shooter.arrowHeadRY = -((shooter.arrowLength - 10) * Math.sin(arrowAngle - 10 / 180 * Math.PI) - shooter.originY);
        //圆弧端点坐标
        shooter.arrowArcLX = (shooter.arrowLength - 25) * Math.cos(arrowAngle + 45 / 180 * Math.PI) + shooter.originX;
        shooter.arrowArcLY = -((shooter.arrowLength - 25) * Math.sin(arrowAngle + 45 / 180 * Math.PI) - shooter.originY);
        shooter.arrowArcRX = (shooter.arrowLength - 25) * Math.cos(arrowAngle - 45 / 180 * Math.PI) + shooter.originX;
        shooter.arrowArcRY = -((shooter.arrowLength - 25) * Math.sin(arrowAngle - 45 / 180 * Math.PI) - shooter.originY);
        //箭头尾部坐标
        shooter.arrowTailX = (shooter.arrowLength - 25) * Math.cos(arrowAngle) + shooter.originX;
        shooter.arrowTailY = -((shooter.arrowLength - 25) * Math.sin(arrowAngle) - shooter.originY);
    };

    const updatePlayerBubble = (deltaT) => {
        //发射出去的泡泡 
        updateLoadingBubble(deltaT);
        //待发射的泡泡
        updateNextOne(deltaT);
    };

    const updateLoadingBubble = (deltaT) => {
        if (playerBubble.loading.trigger && playerBubble.loading.speed > 0) {
            //计算本帧的泡泡位置, 首先记录原来的圆心坐标
            let x = playerBubble.loading.x;
            let y = playerBubble.loading.y;
            let interpolationFactor = 0.85;
            //计算当前时间的圆心位置
            playerBubble.loading.x += deltaT * playerBubble.loading.speed * Math.cos(playerBubble.loading.flyingAngle);
            playerBubble.loading.y -= deltaT * playerBubble.loading.speed * Math.sin(playerBubble.loading.flyingAngle);
            //泡泡移动速度太快，有时碰撞发生时玩家泡泡的圆心已经进入了被碰撞泡泡的网格内，错误的被捕捉到被碰撞泡泡所在网格中，
            //因此这里取碰撞前后两帧中间的一个插值位置作为碰撞时的圆心坐标
            playerBubble.loading.prevX = interpolation(x, playerBubble.loading.x, interpolationFactor);
            playerBubble.loading.prevY = interpolation(y, playerBubble.loading.y, interpolationFactor);
            //碰到左边墙壁
            if (playerBubble.loading.x - grid.cellWidth / 2 < 0) {
                playerBubble.loading.prevY = interpolation(y, playerBubble.loading.y, interpolationFactor);
                playerBubble.loading.x = 0 + grid.cellWidth / 2;
                playerBubble.loading.prevX = x;
                playerBubble.loading.flyingAngle = Math.PI - playerBubble.loading.flyingAngle;
            }
            //碰到右边墙壁
            if (playerBubble.loading.x + grid.cellWidth / 2 > (grid.columns + 0.5) * grid.cellWidth) {
                playerBubble.loading.prevY = interpolation(y, playerBubble.loading.y, interpolationFactor);
                playerBubble.loading.x = grid.columns * grid.cellWidth;
                playerBubble.loading.prevX = x;
                playerBubble.loading.flyingAngle = Math.PI - playerBubble.loading.flyingAngle;
            }
            //碰到天花板
            if (playerBubble.loading.y - grid.cellHeight / 2 < 0) {
                playerBubble.loading.x = x;
                playerBubble.loading.prevX = x;
                playerBubble.loading.y = grid.cellWidth / 2;
                playerBubble.loading.prevY = playerBubble.loading.y;
                playerBubble.loading.speed = 0;
                catchBubble(playerBubble.loading.prevX, playerBubble.loading.prevY);
                return;
            }
            // 碰到其他泡泡
            playerBubble.loading.prevX = interpolation(x, playerBubble.loading.x, interpolationFactor);
            playerBubble.loading.prevY = interpolation(y, playerBubble.loading.y, interpolationFactor);
            let x1 = playerBubble.loading.x;
            let y1 = playerBubble.loading.y;
            let r1 = grid.cellWidth / 2;
            //计算当前玩家泡泡所在的大概网格区域
            let currentIndex = calBubbleIndex(x1, y1);
            let left = currentIndex.j - 2;
            let right = currentIndex.j + 2;
            let top = currentIndex.i - 2;
            let bottom = currentIndex.i + 2;
            if (left < 0) {
                left = 0;
            }
            if (right > grid.columns) {
                right = grid.columns;
            }
            if (top < 0) {
                top = 0;
            }
            if (bottom > grid.rows) {
                bottom = grid.rows;
            }
            //检查该区域内是否有相交的泡泡               
            for (let i = top; i < bottom; i++) {
                for (let j = left; j < right; j++) {
                    //跳过类型为empty的网格单元                        
                    if (grid.cells[i][j].type === "empty") {
                        continue;
                    }
                    let x2 = grid.cells[i][j].getCenter(grid.cellWidth, grid.cellHeight).x;
                    let y2 = grid.cells[i][j].getCenter(grid.cellWidth, grid.cellHeight).y;
                    let r2 = grid.cellWidth / 2;
                    if (checkIntersection(x1, y1, r1, x2, y2, r2)) {
                        playerBubble.loading.speed = 0;
                        catchBubble(playerBubble.loading.prevX, playerBubble.loading.prevY);
                        return;
                    }
                }
            }
        }
    };

    const updateNextOne = (deltaT) => {
        if (playerBubble.nextOne.reload) {
            playerBubble.nextOne.x += playerBubble.nextOne.speed * deltaT;
            if (playerBubble.nextOne.x > shooter.originX) {
                playerBubble.nextOne.x = shooter.originX;
                nextShoot();
            }
        }
    };

    const nextShoot = () => {
        playerBubble.loading = playerBubble.nextOne;
        playerBubble.nextOne = new PlayerBubble(shooter.originX - grid.cellWidth * 3, shooter.originY, 0, 0, randomFrom(0, 6), undefined, 0, false, false);
    };

    //将玩家泡泡捕捉放置到附近网格中
    const catchBubble = (x, y) => {
        let index = calBubbleIndex(x, y);
        //在边界与其他泡泡发生碰撞，有时计算得到的索引值会超出边界
        if (index.i < 0) {
            index.i = 0;
        }
        if (index.i >= grid.columns) {
            index.i = grid.columns - 1;
        }
        if (index.j < 0) {
            index.j = 0;
        }
        if (index.j >= grid.rows) {
            index.j = grid.rows - 1;
        }

        catcherCell = grid.cells[index.i][index.j];
        catcherCell.type = "bubble";
        catcherCell.visible = true;
        catcherCell.color = playerBubble.loading.color;
        //可进行网格上的泡泡状态更新
        bubbleSettled = true;
    };

    //根据泡泡中心的坐标计算它在网格中的i,j值
    const calBubbleIndex = (x, y) => {
        let i = Math.floor(y / grid.cellHeight);
        let j;
        if ((addRowNumber + i) % 2 === 0) {
            j = Math.floor(x / grid.cellWidth);
        } else {
            j = Math.floor((x - grid.cellWidth / 2) / grid.cellWidth);
        }
        return ({ i, j })
    };


    //计算两个圆是否相交
    const checkIntersection = (x1, y1, r1, x2, y2, r2) => {
        let distance = Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2));
        if (r1 + r2 > distance) {
            return true;
        }
        return false;
    };

    const updateGridBubble = (deltaT) => {
        if (bubbleSettled) {
            animationTime += deltaT;
            if (animationTime > duration) {
                animationFinish = true;
            }
            // 动画没开始意味着捕获泡泡后的第1帧
            if (!animationStart) {
                //计算相连泡泡                
                sameColorBubbles = findConnectedBubbles(true, catcherCell);
                //删除3个以上相连泡泡
                if (sameColorBubbles.length >= 3) {
                    for (let i = 0; i < sameColorBubbles.length; i++) {
                        sameColorBubbles[i].type = "empty";
                        sameColorBubbles[i].transparency = 1;
                        score++;
                    }
                    // 计算浮动泡泡                    
                    floatingBubbles = findFloatingBubble();
                    //删除悬空泡泡                
                    for (let i = 0; i < floatingBubbles.length; i++) {
                        floatingBubbles[i].type = "empty";
                        floatingBubbles[i].transparency = 1;
                        score++;
                    }
                    //删除泡泡后进入播放动画阶段
                    if (sameColorBubbles.length >= 3) {
                        animationStart = true;
                    }
                }
            }

            //播放动画
            if (animationStart && !animationFinish) {
                //改变同色相连泡泡的透明度                  
                for (let i = 0; i < sameColorBubbles.length; i++) {
                    sameColorBubbles[i].transparency = 1 - animationTime / duration;
                }
                //改变悬空的泡泡透明度, y轴偏移量               
                for (let i = 0; i < floatingBubbles.length; i++) {
                    floatingBubbles[i].transparency = 1 - animationTime / duration;
                    floatingBubbles[i].deviation = 120 * animationTime / duration;      //动画结束时泡泡落下高度为120像素
                }
            }

            //最后分为消除了泡泡和没有消除泡泡两种情况
            if (animationFinish || sameColorBubbles.length < 3) {
                //消除了泡泡，动画结束需重置同色泡泡和悬空泡泡的透明度,可见度,偏移量
                if (animationFinish) {
                    for (let i = 0; i < sameColorBubbles.length; i++) {
                        sameColorBubbles[i].transparency = 1;
                        sameColorBubbles[i].visible = false;
                    }
                    for (let i = 0; i < floatingBubbles.length; i++) {
                        floatingBubbles[i].transparency = 1;
                        floatingBubbles[i].visible = false;
                        floatingBubbles[i].deviation = 0;
                    }
                }

                //没有消除泡泡，回合计数加1 
                if (sameColorBubbles.length < 3) {
                    roundCount++;
                }

                //检查游戏是否结束
                checkGameOver();

                //计数超过6，增加一行新的泡泡
                if (addRowBubble && roundCount > 6 && !gameOver) {
                    addBubble();
                    roundCount = 0;
                }

                //进行下一次发射
                sameColorBubbles = null;
                floatingBubbles = null;
                animationTime = 0;
                animationStart = false;
                animationFinish = false;
                bubbleSettled = false;
                playerBubble.nextOne.reload = true;

            }
        }
    };

    //提供一个目标泡泡，返回与它相连的所有同色泡泡，或所有与它相连的泡泡（用于查找悬空泡泡）
    const findConnectedBubbles = (checkColor, targetCell) => {
        // 使用一个数组储存相同颜色的邻居泡泡，最初只有目标泡泡
        let toProccess = [targetCell];
        let color = targetCell.color;
        //用一个Set储存已经检查过的单元
        let proccessed = new Set();
        //结果存放数组
        let connectedBubbles = [];
        while (toProccess.length > 0) {
            //每次取出一个泡泡进行处理
            let current = toProccess.pop();
            //如果该泡泡没有被处理过，将它放入结果数组中，如果被处理过，它是一个重复泡泡，进行下一个循环
            if (!proccessed.has(current)) {
                connectedBubbles.push(current);
            } else {
                continue;
            }
            proccessed.add(current);
            let curNeighbor = findNeighbor(current);
            while (curNeighbor.length > 0) {
                let cell = curNeighbor.pop();
                // 每个循环只能标记一个泡泡，而每个泡泡可能有六个同色邻居，因此这里找到的泡泡仍然可能和之前的toProccess中的重复
                if (checkColor && !proccessed.has(cell) && cell.type === "bubble" && cell.color === color) {
                    toProccess.push(cell);
                } else if (!checkColor && !proccessed.has(cell) && cell.type === "bubble") {
                    toProccess.push(cell);
                }
            }
        }
        return connectedBubbles;

    };

    const findFloatingBubble = () => {
        let proccessed = new Set();
        let floatingBubbles = [];
        for (let i = 0; i < grid.rows; i++) {
            for (let j = 0; j < grid.columns; j++) {
                let currentBubble = grid.cells[i][j];
                let connectedBubbles = [];
                let floating = true;
                if (!proccessed.has(currentBubble) && grid.cells[i][j].type === "bubble") {
                    connectedBubbles = findConnectedBubbles(false, grid.cells[i][j]);
                    connectedBubbles.forEach((cell) => {
                        proccessed.add(cell);
                        if (cell.i === 0) {                 //如果相连的泡泡团中有一个和天花板相连，表示不悬空
                            floating = false;
                        }
                    });
                    if (floating) {
                        connectedBubbles.forEach((cell) => {
                            floatingBubbles.push(cell);
                        })
                    }
                }
            }
        }
        return [... new Set(floatingBubbles)];        //去除重复元素
    };

    const findNeighbor = (cell) => {
        let i = cell.i;
        let j = cell.j;
        let possibleIndex = [];
        let neighbors = [];
        //根据所在的行确定可能的6个邻居单元
        if ((addRowNumber + i) % 2 === 0) {
            possibleIndex = [[i, j - 1], [i, j + 1], [i - 1, j], [i - 1, j - 1], [i + 1, j], [i + 1, j - 1]];
        } else {
            possibleIndex = [[i, j - 1], [i, j + 1], [i - 1, j + 1], [i - 1, j], [i + 1, j + 1], [i + 1, j]];
        }
        for (let k = 0; k < possibleIndex.length; k++) {
            let nx = possibleIndex[k][0];
            let ny = possibleIndex[k][1];
            if (nx >= 0 && nx < grid.columns && ny >= 0 && ny < grid.rows) {
                neighbors.push(grid.cells[nx][ny]);
            }
        }
        return neighbors;
    };

    const addBubble = () => {
        // 将泡泡下移一行
        for (let i = grid.rows - 1; i > 0; i--) {
            for (let j = 0; j < grid.columns; j++) {
                grid.cells[i][j].type = grid.cells[i - 1][j].type;
                grid.cells[i][j].color = grid.cells[i - 1][j].color;
                grid.cells[i][j].visible = grid.cells[i - 1][j].visible;
            }
        }
        // 在第一行生成随机泡泡
        for (let j = 0; j <= grid.columns - 1; j++) {
            color = randomFrom(0, 6);
            grid.cells[0][j] = new Cell(color, "bubble", 0, j, 1, true, 0)
        }
        //检查游戏是否结束
        addRowNumber++;
        checkGameOver();
    };

    const checkGameOver = () => {
        for (let j = 0; j < grid.columns; j++) {
            if (grid.cells[12][j].type === "bubble") {
                gameOver = true;
            }
        }
    };

    const render = () => {
        //绘制游戏界面
        drawBackground();
        drawFps();
        drawScore();
        //绘制网格上的泡泡
        drawGridBubble();
        //绘制发射器
        drawShooter();
        //绘制玩家泡泡
        drawPlayerBubble();
        //游戏结束画面
        if (gameOver) {
            drawGameOver();
        }
    };

    const drawBackground = () => {
        context.fillStyle = "#E8E8E8";
        context.fillRect(0, 0, (grid.columns + 0.5) * grid.cellWidth, grid.rows * grid.cellHeight);
    };

    const drawFps = () => {
        context.fillStyle = "#696969";
        context.font = "14px Ariel";
        context.textAlign = "left";
        context.fillText("FPS: " + fps, 20, 505);
    };

    const drawScore = () => {
        context.fillStyle = "#696969";
        context.font = "18px Ariel";
        context.textAlign = "left";
        context.fillText("Score: " + score, 500, 500);
    };

    const drawGameOver = () => {
        context.fillStyle = "rgba(0, 0, 0, 0.5)";
        context.fillRect(0, 150, (grid.columns + 0.5) * grid.cellWidth, 220);
        context.fillStyle = "white";
        context.font = "bold 48px Ariel";
        context.textAlign = "center";
        context.fillText("Game Over", (grid.columns + 0.5) * grid.cellWidth / 2, grid.rows * grid.cellHeight / 2);
    };

    const drawGridBubble = () => {
        for (let i = 0; i < grid.rows; i++) {
            for (let j = 0; j < grid.columns; j++) {
                let cell = grid.cells[i][j];
                let color = colors[cell.color];
                let transparency = cell.transparency;
                let transColor = color.replace("transparency", transparency);
                if (cell.visible) {
                    context.beginPath();
                    let x = cell.getCenter(grid.cellWidth, grid.cellHeight).x;
                    let y = cell.getCenter(grid.cellWidth, grid.cellHeight).y + cell.deviation;
                    context.arc(x, y, grid.cellWidth / 2, 0, 2 * Math.PI, false);
                    context.fillStyle = transColor;
                    context.fill();
                }
            }
        }
    };

    const drawShooter = () => {
        // 绘制箭头
        context.beginPath();
        context.strokeStyle = "#8B8878";
        context.lineWidth = 2;
        context.moveTo(shooter.arrowTailX, shooter.arrowTailY);
        context.lineTo(shooter.arrowHeadX, shooter.arrowHeadY);
        context.moveTo(shooter.arrowHeadX, shooter.arrowHeadY);
        context.lineTo(shooter.arrowHeadLX, shooter.arrowHeadLY);
        context.moveTo(shooter.arrowHeadX, shooter.arrowHeadY);
        context.lineTo(shooter.arrowHeadRX, shooter.arrowHeadRY);
        //绘制箭头尾部圆弧
        context.moveTo(shooter.arrowArcRX, shooter.arrowArcRY);
        context.arc(shooter.originX, shooter.originY, 25, Math.PI * 1 / 4 - shooter.arrowAngle, -Math.PI * 1 / 4 - shooter.arrowAngle, true)
        context.stroke();
        //绘制阴影
        context.beginPath();
        context.fillStyle = "rgba(193,205,205,0.5)";
        context.arc(shooter.originX, shooter.originY, 23, 0, 2 * Math.PI, false);
        context.arc(shooter.originX - grid.cellWidth * 3, shooter.originY, 23, 0, 2 * Math.PI, false);
        context.fill();
    };

    const drawPlayerBubble = () => {
        //泡泡速度大于零才绘制
        if (playerBubble.loading.speed > 0) {
            context.beginPath();
            let loadingColor = colors[playerBubble.loading.color];
            let transparency = 1;
            let transloadingColor = loadingColor.replace("transparency", transparency);
            context.fillStyle = transloadingColor;
            context.arc(playerBubble.loading.x, playerBubble.loading.y, grid.cellWidth / 2, 0, 2 * Math.PI, false);
            context.fill();
        }
        context.beginPath();
        let nextOneColor = colors[playerBubble.nextOne.color];
        let transNextOneColor = nextOneColor.replace("transparency", 1)
        context.fillStyle = transNextOneColor;
        context.arc(playerBubble.nextOne.x, playerBubble.nextOne.y, grid.cellWidth / 2, 0, 2 * Math.PI, false);
        context.fill();
    };

    const randomFrom = (low, high) => {
        return Math.floor(Math.random() * (high - low + 1) + low)
    };

    const interpolation = (x1, x2, factor) => {
        return (x1 + (x2 - x1) * factor)
    }

    const handleMouseDown = (event) => {
        if (event.button === 0) {
            //发射泡泡
            if (!playerBubble.loading.trigger && !gameOver) {
                playerBubble.loading.trigger = true;
                playerBubble.loading.flyingAngle = shooter.arrowAngle;
            }
            //重新开局
            if (gameOver) {
                newGame();
            }
        }
    };

    const handleMouseMove = (event) => {
        if (gameOver) {
            return;
        }
        //改变箭头角度
        let pos = getMousePos(event);
        //限制箭头的方向范围为8-172°
        let low = 8 / 180 * Math.PI;
        let high = 172 / 180 * Math.PI;
        shooter.arrowAngle = Math.atan2(- (pos.y - shooter.originY), pos.x - shooter.originX);
        //在第3，4象限atan2返回的值范围为0到-Pi，将它们转为正数。
        if (shooter.arrowAngle < 0) {
            shooter.arrowAngle += 2 * Math.PI;
        }
        //按鼠标所在的位置分三种情况
        if (shooter.arrowAngle >= high && shooter.arrowAngle <= 1.5 * Math.PI) {
            shooter.arrowAngle = high;
        } else if (shooter.arrowAngle > 1.5 * Math.PI) {
            shooter.arrowAngle = low;
        } else if (shooter.arrowAngle < low) {
            shooter.arrowAngle = low;
        }
    };

    const getMousePos = (event) => {
        let rec = canvas.getBoundingClientRect();
        return {
            x: Math.round((event.clientX - rec.left) / (rec.right - rec.left) * canvas.width),
            y: Math.round((event.clientY - rec.top) / (rec.bottom - rec.top) * canvas.height)
        }
    };

    const handleKeyDown = (event) => {
        if (gameOver && event.keyCode === 27) {               //ESC重开局
            newGame();
        }
    };

    init();
}




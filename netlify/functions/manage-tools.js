const GITHUB_OWNER = "lym5410-sudo";
const GITHUB_REPO = "msps.ai";
const FILE_PATH = "tools.json";
const BRANCH = "main";


/* =========================================================
   GitHub API Headers
========================================================= */

function githubHeaders() {

    return {

        "Authorization":
            `Bearer ${process.env.GITHUB_TOKEN}`,

        "Accept":
            "application/vnd.github+json",

        "X-GitHub-Api-Version":
            "2022-11-28"

    };

}


/* =========================================================
   回應工具
========================================================= */

function jsonResponse(
    statusCode,
    data
) {

    return {

        statusCode,

        headers: {

            "Content-Type":
                "application/json; charset=utf-8",

            "Cache-Control":
                "no-cache"

        },

        body:
            JSON.stringify(data)

    };

}


/* =========================================================
   驗證管理密碼
========================================================= */

function checkPassword(event) {

    const password =
        event.headers["x-admin-password"] ||
        event.headers["X-Admin-Password"];


    return (
        password &&
        password ===
            process.env.ADMIN_PASSWORD
    );

}


/* =========================================================
   讀取 GitHub tools.json
========================================================= */

async function getToolsFile() {

    const url =
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;


    const response =
        await fetch(
            url,
            {
                headers:
                    githubHeaders()
            }
        );


    if (!response.ok) {

        const text =
            await response.text();

        throw new Error(
            `GitHub 讀取失敗：${response.status} ${text}`
        );

    }


    const data =
        await response.json();


    const content =
        Buffer.from(
            data.content.replace(
                /\n/g,
                ""
            ),
            "base64"
        )
        .toString("utf-8");


    let tools;

    try {

        tools =
            JSON.parse(content);

    }
    catch {

        throw new Error(
            "tools.json 格式錯誤，無法解析 JSON"
        );

    }


    return {

        tools:
            Array.isArray(tools)
                ? tools
                : [],

        sha:
            data.sha

    };

}


/* =========================================================
   更新 GitHub tools.json
========================================================= */

async function updateToolsFile(
    tools,
    sha,
    message
) {

    const url =
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;


    const content =
        Buffer.from(
            JSON.stringify(
                tools,
                null,
                4
            ),
            "utf-8"
        )
        .toString("base64");


    const response =
        await fetch(
            url,
            {

                method:
                    "PUT",

                headers: {

                    ...githubHeaders(),

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        message,

                        content,

                        sha,

                        branch:
                            BRANCH

                    })

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.message ||
            "GitHub 更新失敗"
        );

    }


    return data;

}


/* =========================================================
   自動建立 ID
========================================================= */

function createId() {

    return (

        Date.now()
            .toString(36)

        +

        Math.random()
            .toString(36)
            .substring(2, 8)

    );

}


/* =========================================================
   清理文字
========================================================= */

function cleanText(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }

    return String(value).trim();

}


/* =========================================================
   整理關鍵字
========================================================= */

function normalizeKeywords(
    keywords
) {

    if (
        Array.isArray(keywords)
    ) {

        return keywords

            .map(
                keyword =>
                    cleanText(keyword)
            )

            .filter(
                keyword =>
                    keyword !== ""
            );

    }


    if (
        typeof keywords ===
        "string"
    ) {

        return keywords

            .split(
                /[,，、]/
            )

            .map(
                keyword =>
                    keyword.trim()
            )

            .filter(
                keyword =>
                    keyword !== ""
            );

    }


    return [];

}


/* =========================================================
   整理工具資料
========================================================= */

function normalizeTool(
    body,
    oldTool = {}
) {

    const type =
        cleanText(
            body.type ||
            oldTool.type ||
            "student"
        );


    let stage =
        cleanText(
            body.stage ??
            oldTool.stage ??
            ""
        );


    /*
     * 資訊工具不需要學習階段
     */

    if (
        type === "tool"
    ) {

        stage = "";

    }


    return {

        ...oldTool,

        name:
            cleanText(
                body.name ??
                oldTool.name
            ),

        url:
            cleanText(
                body.url ??
                oldTool.url
            ),

        type,

        category:
            cleanText(
                body.category ??
                oldTool.category
            ),

        stage,

        keywords:
            normalizeKeywords(
                body.keywords ??
                oldTool.keywords
            ),

        icon:
            cleanText(
                body.icon ??
                oldTool.icon
            ),

        description:
            cleanText(
                body.description ??
                oldTool.description
            )

    };

}


/* =========================================================
   驗證工具資料
========================================================= */

function validateTool(
    tool
) {

    const requiredFields = [

        "name",
        "url",
        "type",
        "category",
        "icon",
        "description"

    ];


    for (
        const field
        of requiredFields
    ) {

        if (
            !tool[field] ||
            cleanText(
                tool[field]
            ) === ""
        ) {

            return {

                valid: false,

                message:
                    `缺少必要欄位：${field}`

            };

        }

    }


    /*
     * type 必須是三大專區之一
     */

    const validTypes = [

        "student",
        "teacher",
        "tool"

    ];


    if (
        !validTypes.includes(
            tool.type
        )
    ) {

        return {

            valid: false,

            message:
                "專區類型錯誤，只能是 student、teacher 或 tool"

        };

    }


    /*
     * 學生／教師專區必須有學習階段
     */

    if (
        (
            tool.type === "student" ||
            tool.type === "teacher"
        )
        &&
        !tool.stage
    ) {

        return {

            valid: false,

            message:
                "學生專區或教師專區需要填寫學習階段"

        };

    }


    return {

        valid: true

    };

}


/* =========================================================
   Netlify Function
========================================================= */

exports.handler =
    async function(event) {

        try {

            const method =
                event.httpMethod;


            /* =================================================
               GET
               讀取所有工具
            ================================================= */

            if (
                method === "GET"
            ) {

                const {
                    tools
                } =
                    await getToolsFile();


                return jsonResponse(

                    200,

                    {

                        success: true,

                        tools

                    }

                );

            }


            /* =================================================
               POST
               登入 / 新增工具
            ================================================= */

            if (
                method === "POST"
            ) {

                /*
                 * 所有 POST 都需要管理密碼
                 */

                if (
                    !checkPassword(
                        event
                    )
                ) {

                    return jsonResponse(

                        401,

                        {

                            success: false,

                            message:
                                "管理密碼錯誤"

                        }

                    );

                }


                let body;


                try {

                    body =
                        JSON.parse(
                            event.body ||
                            "{}"
                        );

                }
                catch {

                    return jsonResponse(

                        400,

                        {

                            success: false,

                            message:
                                "JSON 格式錯誤"

                        }

                    );

                }


                /* =============================================
                   管理員登入
                ============================================= */

                if (
                    body.action ===
                    "login"
                ) {

                    return jsonResponse(

                        200,

                        {

                            success: true,

                            message:
                                "登入成功"

                        }

                    );

                }


                /* =============================================
                   新增工具
                ============================================= */

                const newTool =
                    normalizeTool(
                        body
                    );


                const validation =
                    validateTool(
                        newTool
                    );


                if (
                    !validation.valid
                ) {

                    return jsonResponse(

                        400,

                        {

                            success: false,

                            message:
                                validation.message

                        }

                    );

                }


                const {
                    tools,
                    sha
                } =
                    await getToolsFile();


                /*
                 * 建立 ID
                 */

                newTool.id =
                    createId();


                /*
                 * 新工具放最前面
                 */

                tools.unshift(
                    newTool
                );


                await updateToolsFile(

                    tools,

                    sha,

                    `新增工具：${newTool.name}`

                );


                return jsonResponse(

                    200,

                    {

                        success: true,

                        message:
                            "工具新增成功",

                        tool:
                            newTool

                    }

                );

            }


            /* =================================================
               PUT
               修改工具
            ================================================= */

            if (
                method === "PUT"
            ) {

                if (
                    !checkPassword(
                        event
                    )
                ) {

                    return jsonResponse(

                        401,

                        {

                            success: false,

                            message:
                                "未授權"

                        }

                    );

                }


                let body;


                try {

                    body =
                        JSON.parse(
                            event.body ||
                            "{}"
                        );

                }
                catch {

                    return jsonResponse(

                        400,

                        {

                            success: false,

                            message:
                                "JSON 格式錯誤"

                        }

                    );

                }


                if (
                    !body.id
                ) {

                    return jsonResponse(

                        400,

                        {

                            success: false,

                            message:
                                "缺少工具 ID"

                        }

                    );

                }


                const {
                    tools,
                    sha
                } =
                    await getToolsFile();


                const index =
                    tools.findIndex(

                        tool =>

                            String(
                                tool.id
                            ) ===

                            String(
                                body.id
                            )

                    );


                if (
                    index === -1
                ) {

                    return jsonResponse(

                        404,

                        {

                            success: false,

                            message:
                                "找不到工具"

                        }

                    );

                }


                /*
                 * 保留原本 ID
                 */

                const updatedTool =
                    normalizeTool(

                        body,

                        tools[index]

                    );


                updatedTool.id =
                    tools[index].id;


                const validation =
                    validateTool(
                        updatedTool
                    );


                if (
                    !validation.valid
                ) {

                    return jsonResponse(

                        400,

                        {

                            success: false,

                            message:
                                validation.message

                        }

                    );

                }


                tools[index] =
                    updatedTool;


                await updateToolsFile(

                    tools,

                    sha,

                    `修改工具：${updatedTool.name}`

                );


                return jsonResponse(

                    200,

                    {

                        success: true,

                        message:
                            "工具修改成功",

                        tool:
                            updatedTool

                    }

                );

            }


            /* =================================================
               DELETE
               刪除工具
            ================================================= */

            if (
                method === "DELETE"
            ) {

                if (
                    !checkPassword(
                        event
                    )
                ) {

                    return jsonResponse(

                        401,

                        {

                            success: false,

                            message:
                                "未授權"

                        }

                    );

                }


                let body;


                try {

                    body =
                        JSON.parse(
                            event.body ||
                            "{}"
                        );

                }
                catch {

                    return jsonResponse(

                        400,

                        {

                            success: false,

                            message:
                                "JSON 格式錯誤"

                        }

                    );

                }


                if (
                    !body.id
                ) {

                    return jsonResponse(

                        400,

                        {

                            success: false,

                            message:
                                "缺少工具 ID"

                        }

                    );

                }


                const {
                    tools,
                    sha
                } =
                    await getToolsFile();


                const index =
                    tools.findIndex(

                        tool =>

                            String(
                                tool.id
                            ) ===

                            String(
                                body.id
                            )

                    );


                if (
                    index === -1
                ) {

                    return jsonResponse(

                        404,

                        {

                            success: false,

                            message:
                                "找不到工具"

                        }

                    );

                }


                const deleted =
                    tools[index];


                tools.splice(
                    index,
                    1
                );


                await updateToolsFile(

                    tools,

                    sha,

                    `刪除工具：${deleted.name}`

                );


                return jsonResponse(

                    200,

                    {

                        success: true,

                        message:
                            "工具刪除成功",

                        deleted:
                            deleted

                    }

                );

            }


            /* =================================================
               不支援的方法
            ================================================= */

            return jsonResponse(

                405,

                {

                    success: false,

                    message:
                        "不支援的請求方法"

                }

            );

        }


        catch (error) {

            console.error(
                "manage-tools error:",
                error
            );


            return jsonResponse(

                500,

                {

                    success: false,

                    message:
                        error.message ||
                        "伺服器錯誤"

                }

            );

        }

    };

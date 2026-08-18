const GITHUB_OWNER = "lym5410-sudo";
const GITHUB_REPO = "msps.ai";
const FILE_PATH = "tools.json";
const BRANCH = "main";


// ========================================
// GitHub API
// ========================================

const githubHeaders = () => ({
    "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
});


// ========================================
// 驗證管理密碼
// ========================================

function checkPassword(event) {

    const password =
        event.headers["x-admin-password"] ||
        event.headers["X-Admin-Password"];

    if (!password) {
        return false;
    }

    return password === process.env.ADMIN_PASSWORD;
}


// ========================================
// 取得 tools.json
// ========================================

async function getToolsFile() {

    const url =
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;

    const response =
        await fetch(
            url,
            {
                headers: githubHeaders()
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
            data.content.replace(/\n/g, ""),
            "base64"
        ).toString("utf-8");


    let tools;

    try {

        tools =
            JSON.parse(content);

    } catch {

        throw new Error(
            "tools.json 格式錯誤"
        );

    }


    return {
        tools: Array.isArray(tools)
            ? tools
            : [],
        sha: data.sha
    };

}


// ========================================
// 更新 tools.json
// ========================================

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
        ).toString("base64");


    const response =
        await fetch(
            url,
            {

                method: "PUT",

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

                        branch: BRANCH

                    })

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.message ||
            `GitHub 更新失敗：${response.status}`
        );

    }


    return data;

}


// ========================================
// 建立 ID
// ========================================

function createId() {

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .substring(2, 8)
    );

}


// ========================================
// Netlify Function
// ========================================

exports.handler =
    async function(event) {

        try {

            const method =
                event.httpMethod;


            // ====================================
            // GET
            // 公開讀取工具
            // ====================================

            if (method === "GET") {

                const {
                    tools
                } =
                    await getToolsFile();


                return {

                    statusCode: 200,

                    headers: {
                        "Content-Type":
                            "application/json",
                        "Cache-Control":
                            "no-cache"
                    },

                    body:
                        JSON.stringify({

                            success: true,

                            tools

                        })

                };

            }


            // ====================================
            // POST
            // 登入 / 新增
            // ====================================

            if (method === "POST") {

                let body = {};

                try {

                    body =
                        event.body
                            ? JSON.parse(
                                event.body
                            )
                            : {};

                } catch {

                    return {

                        statusCode: 400,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "JSON 格式錯誤"

                            })

                    };

                }


                // =================================
                // 真正的登入
                // =================================

                if (
                    body.action ===
                    "login"
                ) {

                    if (
                        !checkPassword(
                            event
                        )
                    ) {

                        return {

                            statusCode: 401,

                            body:
                                JSON.stringify({

                                    success: false,

                                    message:
                                        "管理密碼錯誤"

                                })

                        };

                    }


                    return {

                        statusCode: 200,

                        body:
                            JSON.stringify({

                                success: true,

                                message:
                                    "登入成功"

                            })

                    };

                }


                // =================================
                // 新增工具前驗證
                // =================================

                if (
                    !checkPassword(
                        event
                    )
                ) {

                    return {

                        statusCode: 401,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "未授權"

                            })

                    };

                }


                const {
                    tools,
                    sha
                } =
                    await getToolsFile();


                // =================================
                // 欄位驗證
                // =================================

                const requiredFields = [
                    "name",
                    "url",
                    "category",
                    "grade",
                    "icon",
                    "description"
                ];


                for (
                    const field
                    of requiredFields
                ) {

                    if (
                        !body[field] ||
                        String(
                            body[field]
                        ).trim() === ""
                    ) {

                        return {

                            statusCode: 400,

                            body:
                                JSON.stringify({

                                    success: false,

                                    message:
                                        `缺少必要欄位：${field}`

                                })

                        };

                    }

                }


                // =================================
                // 建立新工具
                // =================================

                const newTool = {

                    id:
                        createId(),

                    name:
                        String(
                            body.name
                        ).trim(),

                    url:
                        String(
                            body.url
                        ).trim(),

                    category:
                        String(
                            body.category
                        ).trim(),

                    grade:
                        String(
                            body.grade
                        ).trim(),

                    icon:
                        String(
                            body.icon
                        ).trim(),

                    description:
                        String(
                            body.description
                        ).trim()

                };


                tools.push(
                    newTool
                );


                await updateToolsFile(
                    tools,
                    sha,
                    `新增工具：${newTool.name}`
                );


                return {

                    statusCode: 200,

                    body:
                        JSON.stringify({

                            success: true,

                            message:
                                "工具新增成功",

                            tool:
                                newTool

                        })

                };

            }


            // ====================================
            // PUT
            // 編輯工具
            // ====================================

            if (method === "PUT") {

                if (
                    !checkPassword(
                        event
                    )
                ) {

                    return {

                        statusCode: 401,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "未授權"

                            })

                    };

                }


                let body;

                try {

                    body =
                        JSON.parse(
                            event.body || "{}"
                        );

                } catch {

                    return {

                        statusCode: 400,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "JSON 格式錯誤"

                            })

                    };

                }


                if (!body.id) {

                    return {

                        statusCode: 400,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "缺少工具 ID"

                            })

                    };

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


                if (index === -1) {

                    return {

                        statusCode: 404,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "找不到指定工具"

                            })

                    };

                }


                const updatedTool = {

                    ...tools[index],

                    name:
                        String(
                            body.name
                        ).trim(),

                    url:
                        String(
                            body.url
                        ).trim(),

                    category:
                        String(
                            body.category
                        ).trim(),

                    grade:
                        String(
                            body.grade
                        ).trim(),

                    icon:
                        String(
                            body.icon
                        ).trim(),

                    description:
                        String(
                            body.description
                        ).trim()

                };


                tools[index] =
                    updatedTool;


                await updateToolsFile(
                    tools,
                    sha,
                    `修改工具：${updatedTool.name}`
                );


                return {

                    statusCode: 200,

                    body:
                        JSON.stringify({

                            success: true,

                            message:
                                "工具修改成功",

                            tool:
                                updatedTool

                        })

                };

            }


            // ====================================
            // DELETE
            // 刪除工具
            // ====================================

            if (method === "DELETE") {

                if (
                    !checkPassword(
                        event
                    )
                ) {

                    return {

                        statusCode: 401,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "未授權"

                            })

                    };

                }


                let body;

                try {

                    body =
                        JSON.parse(
                            event.body || "{}"
                        );

                } catch {

                    return {

                        statusCode: 400,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "JSON 格式錯誤"

                            })

                    };

                }


                if (!body.id) {

                    return {

                        statusCode: 400,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "缺少工具 ID"

                            })

                    };

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


                if (index === -1) {

                    return {

                        statusCode: 404,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "找不到指定工具"

                            })

                    };

                }


                const deletedTool =
                    tools[index];


                tools.splice(
                    index,
                    1
                );


                await updateToolsFile(
                    tools,
                    sha,
                    `刪除工具：${deletedTool.name}`
                );


                return {

                    statusCode: 200,

                    body:
                        JSON.stringify({

                            success: true,

                            message:
                                "工具刪除成功"

                        })

                };

            }


            // ====================================
            // 不支援的方法
            // ====================================

            return {

                statusCode: 405,

                body:
                    JSON.stringify({

                        success: false,

                        message:
                            "不支援的請求方法"

                    })

            };

        }

        catch (error) {

            console.error(
                "manage-tools error:",
                error
            );


            return {

                statusCode: 500,

                body:
                    JSON.stringify({

                        success: false,

                        message:
                            error.message ||
                            "伺服器發生錯誤"

                    })

            };

        }

    };

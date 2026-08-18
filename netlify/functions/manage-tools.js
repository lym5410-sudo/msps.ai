const GITHUB_OWNER = "lym5410-sudo";
const GITHUB_REPO = "msps.ai";
const FILE_PATH = "tools.json";
const BRANCH = "main";


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


    const tools =
        JSON.parse(content);


    return {

        tools:
            Array.isArray(tools)
            ? tools
            : [],

        sha:
            data.sha

    };

}


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


exports.handler =
    async function(event) {

        try {

            const method =
                event.httpMethod;


            /* =========================
               GET
            ========================= */

            if (
                method ===
                "GET"
            ) {

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


            /* =========================
               POST
            ========================= */

            if (
                method ===
                "POST"
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


                let body;


                try {

                    body =
                        JSON.parse(
                            event.body ||
                            "{}"
                        );

                }
                catch {

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


                /* ===== 登入 ===== */

                if (
                    body.action ===
                    "login"
                ) {

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


                /* ===== 新增 ===== */

                const required = [

                    "name",
                    "url",
                    "type",
                    "category",
                    "icon",
                    "description"

                ];


                for (
                    const field
                    of required
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


                const {
                    tools,
                    sha
                } =
                    await getToolsFile();


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

                    type:
                        String(
                            body.type
                        ).trim(),

                    category:
                        String(
                            body.category
                        ).trim(),

                    stage:
                        body.type ===
                        "tool"
                        ? ""
                        : String(
                            body.stage ||
                            ""
                        ).trim(),

                    keywords:
                        Array.isArray(
                            body.keywords
                        )
                        ? body.keywords
                        : [],

                    icon:
                        String(
                            body.icon
                        ).trim(),

                    description:
                        String(
                            body.description
                        ).trim()

                };


                tools.unshift(
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


            /* =========================
               PUT
            ========================= */

            if (
                method ===
                "PUT"
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
                                    "未授權"

                            })

                    };

                }


                const body =
                    JSON.parse(
                        event.body ||
                        "{}"
                    );


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


                if (
                    index === -1
                ) {

                    return {

                        statusCode: 404,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "找不到工具"

                            })

                    };

                }


                tools[index] = {

                    ...tools[index],

                    name:
                        String(
                            body.name ||
                            ""
                        ).trim(),

                    url:
                        String(
                            body.url ||
                            ""
                        ).trim(),

                    type:
                        String(
                            body.type ||
                            "student"
                        ).trim(),

                    category:
                        String(
                            body.category ||
                            ""
                        ).trim(),

                    stage:
                        body.type ===
                        "tool"
                        ? ""
                        : String(
                            body.stage ||
                            ""
                        ).trim(),

                    keywords:
                        Array.isArray(
                            body.keywords
                        )
                        ? body.keywords
                        : [],

                    icon:
                        String(
                            body.icon ||
                            ""
                        ).trim(),

                    description:
                        String(
                            body.description ||
                            ""
                        ).trim()

                };


                await updateToolsFile(

                    tools,

                    sha,

                    `修改工具：${tools[index].name}`

                );


                return {

                    statusCode: 200,

                    body:
                        JSON.stringify({

                            success: true,

                            message:
                                "工具修改成功",

                            tool:
                                tools[index]

                        })

                };

            }


            /* =========================
               DELETE
            ========================= */

            if (
                method ===
                "DELETE"
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
                                    "未授權"

                            })

                    };

                }


                const body =
                    JSON.parse(
                        event.body ||
                        "{}"
                    );


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

                    return {

                        statusCode: 404,

                        body:
                            JSON.stringify({

                                success: false,

                                message:
                                    "找不到工具"

                            })

                    };

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
                error
            );


            return {

                statusCode: 500,

                body:
                    JSON.stringify({

                        success: false,

                        message:
                            error.message ||
                            "伺服器錯誤"

                    })

            };

        }

    };

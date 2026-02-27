#!/usr/bin/env python3
"""Rewrite git history to use single author (auto confirm)"""

import subprocess
import os
import sys

# New author info
NEW_NAME = "Hopemyl"
NEW_EMAIL = "Hopemyl@noreply.gitcode.com"

def run_cmd(cmd, **kwargs):
    """运行命令并打印输出"""
    print(f">>> {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, **kwargs)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result

def main():
    print("警告: 这将重写整个 git 历史，所有 commit hash 会改变！")
    print(f"所有提交将被改为: {NEW_NAME} <{NEW_EMAIL}>")
    print("自动确认继续...\n")

    # Step 1: 创建 mailmap
    print("\nStep 1: Creating mailmap...")
    with open(".mailmap", "w", encoding='utf-8') as f:
        f.write(f"{NEW_NAME} <{NEW_EMAIL}>\n")

    # Step 2: 使用 git filter-branch 重写历史
    print("\nStep 2: Rewriting history...")

    env_filter = f'''
export GIT_AUTHOR_NAME="{NEW_NAME}"
export GIT_AUTHOR_EMAIL="{NEW_EMAIL}"
export GIT_COMMITTER_NAME="{NEW_NAME}"
export GIT_COMMITTER_EMAIL="{NEW_EMAIL}"
'''

    result = run_cmd([
        "git", "filter-branch", "-f",
        "--env-filter", env_filter,
        "--tag-name-filter", "cat",
        "--", "--all"
    ])

    if result.returncode != 0:
        print("错误: 重写历史失败")
        sys.exit(1)

    print("历史重写成功！")

    # Step 3: 清理
    print("\nStep 3: Cleaning up...")
    run_cmd(["git", "update-ref", "-d", "refs/original/refs/heads/main"])
    run_cmd(["git", "reflog", "expire", "--expire=now", "--all"])
    run_cmd(["git", "gc", "--aggressive", "--prune=now"])

    # Step 4: 显示结果
    print("\nStep 4: 新的提交统计:")
    run_cmd(["git", "shortlog", "-sne"])

    print("\n" + "="*50)
    print("完成！现在执行以下命令强制推送到远程:")
    print("  git push --force-with-lease origin main")
    print("如果有其他分支，也需要推送:")
    print("  git push --force --all origin")
    print("  git push --force --tags origin")
    print("="*50)

if __name__ == "__main__":
    main()

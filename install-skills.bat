@echo off
echo Instalando y linkeando skills para DocuChat...

skills add supabase/agent-skills -g --skill supabase-postgres-best-practices --agent claude-code -y
skills add Jeffallan/claude-skills -g --skill code-reviewer --agent claude-code -y
skills add Jeffallan/claude-skills -g --skill security-reviewer --agent claude-code -y
skills add wshobson/agents -g --skill debugging-strategies --agent claude-code -y
skills add wshobson/agents -g --skill error-handling-patterns --agent claude-code -y
skills add wshobson/agents -g --skill typescript-advanced-types --agent claude-code -y
skills add Jeffallan/claude-skills -g --skill rag-architect --agent claude-code -y
skills add Jeffallan/claude-skills -g --skill nextjs-developer --agent claude-code -y
skills add Jeffallan/claude-skills -g --skill postgres-pro --agent claude-code -y
skills add Jeffallan/claude-skills -g --skill typescript-pro --agent claude-code -y
skills add Jeffallan/claude-skills -g --skill react-expert --agent claude-code -y
skills add Jeffallan/claude-skills -g --skill test-master --agent claude-code -y
skills add wshobson/agents -g --skill backend-development --agent claude-code -y
skills add wshobson/agents -g --skill unit-testing --agent claude-code -y

echo.
echo === RESULTADO FINAL ===
skills ls -g

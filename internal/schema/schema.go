package schema

type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

type ToolCall struct {
	ID        string
	Name      string
	Arguments []byte
}

type Message struct {
	Role       Role
	Content    string
	ToolCallID string
	ToolCalls  []ToolCall
}

type ToolDefinition struct {
	Name        string
	Description string
	InputSchema any
}

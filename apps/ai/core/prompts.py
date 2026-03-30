from pathlib import Path


def render_prompt(template_path: str, context: dict) -> str:
    """Render a Jinja2 template file with given context.
    If the template file doesn't exist, returns a basic system prompt string."""
    template_file = Path(template_path)
    if not template_file.exists():
        # Fallback: compose a basic system prompt from context
        agent_name = context.get("agent_name", "AI Assistant")
        company = context.get("company_name", "")
        description = context.get("company_description", "")
        voice = context.get("brand_voice", "Professional and helpful")
        base = f"You are {agent_name}, an AI assistant."
        if company:
            base += f" You work for {company}."
        if description:
            base += f" {description}"
        base += f" Your communication style is: {voice}."
        return base

    try:
        from jinja2 import Environment, FileSystemLoader, select_autoescape
        env = Environment(
            loader=FileSystemLoader(str(template_file.parent)),
            autoescape=select_autoescape(disabled_extensions=("j2",)),
        )
        template = env.get_template(template_file.name)
        return template.render(**context)
    except Exception as e:
        return f"You are a helpful AI assistant. (Template error: {e})"

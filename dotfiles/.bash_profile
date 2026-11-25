git_branch_suffix() {
    git branch 2>/dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/ (\1)/'
}

yellow='\[\e[0;93m\]'
magenta='\[\e[0;95m\]'
green='\[\e[0;92m\]'
reset='\[\e[m\]'
export PS1="${yellow}\u${reset} ${magenta}\W${reset}${green}\$(git_branch_suffix)${reset} >> "
unset yellow magenta green reset

alias ls='lsd -Alh'
alias gits='git status'
alias lg='lazygit'
alias y='yazi'
alias z='zellij attach -c DEV'

export ASPNETCORE_ENVIRONMENT=Development
export PATH="$HOME/.local/bin:$PATH"

cp -R "$(dirname "$0")/fixture/." .
git init -q -b main && git add -A && git -c user.name=dev -c user.email=dev@example.com commit -qm "Start"
mkdir -p team-notes && cp "$(dirname "$0")/notes/"*.md team-notes/
echo "team-notes/" >> .git/info/exclude

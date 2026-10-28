#!/bin/sh
# Runs a fuzz campaign over this package's Fuzz targets, one after another,
# then measures Go statement coverage of the compiler's packages over the
# seed corpus plus testdata/fuzz, and prints one row per package.
#
#   cd typescript/tsc
#   ES_REMOTE_HOST=ubuntu@<host> ES_REMOTE_KEY=~/.ssh/<key> \
#     sh ../../scripts/remote.sh sh internal/vibelangfuzz/campaign.sh 5m
#   ... campaign.sh 5m FuzzCompile=10m FuzzParse FuzzConfig
#
# The first argument is each target's default duration; the others name the
# targets to run, each optionally with its own duration. With no targets it
# runs every Fuzz target in the package. Run it on the build host, never on a
# laptop: a campaign builds the compiler and keeps six workers busy. The host
# is shared, so a campaign uses -parallel 6 (CAMPAIGN_PARALLEL overrides it).
#
# The fuzzer writes a new crasher to testdata/fuzz/<target>/; the campaign
# moves each to $CAMPAIGN_OUT/crashers/<target>/, outside the tree a remote.sh
# sync replaces, so that the coverage run measures the committed corpus and a
# crasher cannot stop it. The summary lists them; copy the ones to keep into
# the workspace's testdata/fuzz/<target>/ after minimizing them.
set -eu
# A campaign with a missing dependency fails instead of fuzzing nothing.
export VIBELANG_FUZZ_REQUIRE=1

here=$(cd "$(dirname "$0")" && pwd)
tsc=$(cd "$here/../.." && pwd)
cd "$tsc"
pkg=./internal/vibelangfuzz/
parallel=${CAMPAIGN_PARALLEL:-6}
duration=${1:-5m}
[ $# -gt 0 ] && shift
coverpkg=./internal/vibelang,./internal/vibelangfmt,./internal/vibelangestree,./internal/vibelangmapper,./internal/parser,./internal/checker,./internal/ls,./internal/format,./internal/printer
out=${CAMPAIGN_OUT:-$(mktemp -d "${TMPDIR:-/tmp}/vibelangfuzz-campaign.XXXXXX")}
mkdir -p "$out"

targets=$*
if [ -z "$targets" ]; then
	targets=$(GOFLAGS= go test -list '^Fuzz' "$pkg" | grep '^Fuzz')
fi

summary="$out/summary.txt"
: > "$summary"
failed=0
names=""
for spec in $targets; do
	target=${spec%%=*}
	time=$duration
	[ "$spec" != "$target" ] && time=${spec#*=}
	names="$names${names:+|}$target"
	corpus="$here/testdata/fuzz/$target"
	before=$(ls "$corpus" 2>/dev/null | sort || true)
	echo "== $target for $time (-parallel $parallel)" >&2
	status=0
	GOFLAGS= go test -run '^$' -fuzz "^$target\$" -fuzztime "$time" -parallel "$parallel" "$pkg" > "$out/$target.log" 2>&1 || status=$?
	last=$(grep -E '^fuzz: elapsed' "$out/$target.log" | tail -1)
	after=$(ls "$corpus" 2>/dev/null | sort || true)
	new=$(printf '%s\n' "$after" | grep -vxF -e "$before" -e '' || true)
	[ -z "$before" ] && new=$after
	{
		echo "$target  $time  exit $status"
		echo "  ${last:-no progress line; see $out/$target.log}"
		for file in $new; do
			echo "  new crasher: $out/crashers/$target/$file"
			mkdir -p "$out/crashers/$target" && mv "$corpus/$file" "$out/crashers/$target/"
		done
		if [ "$status" -ne 0 ]; then failed=1; grep -m 5 -E '^\s+--- FAIL|Failing input|panic:|hang:' "$out/$target.log" | sed 's/^/  /' || true; fi
	} >> "$summary"
done

echo "== coverage over the seed corpus and testdata/fuzz" >&2
profile="$out/cover.out"
# Instrumented, the compiler runs several times slower, so a stage that
# takes seconds is not a hang here; the campaign above hunted those.
VIBELANG_FUZZ_HANG=${VIBELANG_FUZZ_HANG:-300s} GOFLAGS= go test -run "^($names)\$" -count=1 -coverpkg="$coverpkg" -coverprofile="$profile" "$pkg" > "$out/coverage.log" 2>&1 || {
	failed=1
	echo "the coverage run failed; see $out/coverage.log" >&2
	tail -20 "$out/coverage.log" >&2
}

echo
echo "Campaign ($out)"
cat "$summary"
echo
echo "Statement coverage over the seed corpus and testdata/fuzz"
if [ -s "$profile" ]; then
	# A block may appear more than once in a profile; count it once, as
	# covered when any copy ran.
	awk -F'[: ]' 'NR > 1 {
		key = $1 ":" $2
		stmts[key] = $3
		if ($4 > 0) hit[key] = 1
	}
	END {
		if (length(stmts) == 0) { print "the profile holds no blocks"; exit }
		for (key in stmts) {
			file = key; sub(/:.*/, "", file)
			pkg = file; sub(/\/[^\/]*$/, "", pkg); sub(/^.*\/internal\//, "internal/", pkg)
			total[pkg] += stmts[key]; all += stmts[key]
			if (key in hit) { covered[pkg] += stmts[key]; done += stmts[key] }
		}
		printf "%-28s %10s %10s %8s\n", "package", "statements", "covered", "percent"
		n = 0
		for (pkg in total) names[++n] = pkg
		for (i = 1; i <= n; i++) for (j = i + 1; j <= n; j++) if (names[j] < names[i]) { t = names[i]; names[i] = names[j]; names[j] = t }
		for (i = 1; i <= n; i++) {
			pkg = names[i]
			printf "%-28s %10d %10d %7.1f%%\n", pkg, total[pkg], covered[pkg], 100 * covered[pkg] / total[pkg]
		}
		printf "%-28s %10d %10d %7.1f%%\n", "total", all, done, 100 * done / all
	}' "$profile"
else
	echo "no profile"
fi
# The status is nonzero when a target found a failure or a run broke.
exit "$failed"

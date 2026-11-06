-- rexeme: keep every themeable app on Rex's theme.
--
-- Load it from your Rex config (~/.config/rex/init.lua):
--
--   -- with Amber (https://github.com/rawnly/amber)
--   { "DeepanshuMishraa/rexeme", opts = { keys = { sync = "opt+space>t" } } }
--
--   -- or directly
--   dofile("/path/to/rexeme/lua/rexeme/init.lua").setup({})
--
-- `rexeme plugin install` writes the direct form for you.
--
-- The actions run the rexeme CLI with rex.exec on the server's machine. They
-- add nothing to the keymap unless `keys` asks for it.

local M = {}

local DEFAULT_PATH = table.concat({
  (os.getenv("HOME") or "") .. "/.bun/bin",
  (os.getenv("HOME") or "") .. "/.local/bin",
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
}, ":")

local SHELL = "com.superlogical.terminal.shell"

-- Rex calls `setup` on every config load and check, so it only reads options
-- and registers actions; nothing runs until an action does.
function M.setup(opts)
  opts = opts or {}
  local bin = opts.bin or { "rexeme" }
  if type(bin) == "string" then bin = { bin } end
  local env = { PATH = opts.path or DEFAULT_PATH }
  local log = opts.log or ((os.getenv("HOME") or "") .. "/Library/Logs/rexeme.log")

  local function argv(...)
    local out = {}
    for _, part in ipairs(bin) do out[#out + 1] = part end
    for _, part in ipairs({ ... }) do out[#out + 1] = part end
    return out
  end

  -- Runs a rexeme subcommand and returns its output, or raises an error the
  -- palette shows, naming the command so it can be retried in a terminal.
  local function run(...)
    local command = argv(...)
    local r, err = rex.exec(command, { env = env, timeout = 25 })
    if r == nil then
      error("rexeme: couldn't start `" .. table.concat(command, " ") .. "`: " .. tostring(err)
        .. ". Install rexeme or pass its path as `bin` in the plugin options.", 0)
    end
    local output = (r.stdout or "") .. (r.stderr or "")
    if r.timed_out then
      error("rexeme: `" .. table.concat(command, " ") .. "` timed out after 25s. Tool configs may be partly updated; run it in a terminal to see where it stops.", 0)
    end
    if not r.ok then
      error("rexeme: `" .. table.concat(command, " ") .. "` exited " .. tostring(r.code) .. ":\n" .. output, 0)
    end
    return output
  end

  -- Opens a terminal beside the pane the action ran from and keeps it open.
  local function beside(ctx, label, command, direction)
    local _, err = rex.session.new_split{
      anchor_id = ctx.block_id,
      direction = direction or "horizontal",
      side = "after",
      focus = true,
      layout = {
        block = {
          flavor = SHELL,
          label = label,
          options = { command = command, exit = { on_completion = false } },
        },
      },
    }
    if err ~= nil then error("rexeme: couldn't open a pane: " .. tostring(err), 0) end
  end

  rex.action{
    name = "rexeme_sync",
    title = "Rexeme: Sync Apps to Rex Theme",
    description = "Apply Rex's current theme to every installed editor, terminal and CLI tool.",
    category = "Rexeme",
    keywords = "theme colors sync vscode zed neovim",
    args = { only = "string?" },
    run = function(_, args)
      if args.only ~= nil and args.only ~= "" then
        return { output = run("sync", "--only", args.only) }
      end
      return { output = run("sync") }
    end,
  }

  rex.action{
    name = "rexeme_status",
    title = "Rexeme: Show Theme Status",
    description = "Open a pane listing Rex's theme choice and which apps rexeme themes.",
    category = "Rexeme",
    keywords = "theme status apps",
    run = function(ctx)
      beside(ctx, "rexeme status", argv("status"))
    end,
  }

  rex.action{
    name = "rexeme_follow",
    title = "Rexeme: Follow Rex Theme in Background",
    description = "Start the login agent that re-themes apps whenever Rex's theme or light/dark mode changes.",
    category = "Rexeme",
    keywords = "theme watch install background auto",
    run = function()
      return { output = run("install") }
    end,
  }

  rex.action{
    name = "rexeme_unfollow",
    title = "Rexeme: Stop Following Rex Theme",
    description = "Stop the background watcher. Apps keep their current colors.",
    category = "Rexeme",
    keywords = "theme watch uninstall stop",
    run = function()
      return { output = run("uninstall") }
    end,
  }

  rex.action{
    name = "rexeme_log",
    title = "Rexeme: Show Watcher Log",
    description = "Tail the background watcher's log in a pane below.",
    category = "Rexeme",
    keywords = "theme log debug",
    run = function(ctx)
      beside(ctx, "rexeme log", { "tail", "-n", "200", "-F", log }, "vertical")
    end,
  }

  -- Optional bindings: keys = { sync = "opt+space>t", status = "...", ... }
  for short, key in pairs(opts.keys or {}) do
    rex.bind(key, "rexeme_" .. short)
  end
end

return M

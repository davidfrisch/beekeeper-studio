<template>
  <div class="cell-editor-drawer">
    <template v-if="hasCell">
      <div class="header">
        <div class="header-group">
          <span class="column-name truncate" :title="columnName">{{ columnName }}</span>
          <span class="badge column-data-type" v-if="dataType">{{ dataType }}</span>
        </div>
        <div class="header-group actions">
          <span class="read-only-hint" v-if="readOnly">Read-only</span>
          <x-button
            class="menu-btn btn btn-fab"
            tabindex="0"
          >
            <i class="material-icons">more_vert</i>
            <x-menu style="--target-align:right;">
              <template v-if="isJson">
                <x-menuitem @click.prevent="reformat(2)">
                  <x-label>Format</x-label>
                </x-menuitem>
                <x-menuitem @click.prevent="reformat()">
                  <x-label>Minify</x-label>
                </x-menuitem>
              </template>
              <x-menuitem togglable :toggled="wrapText" @click.prevent="wrapText = !wrapText">
                <x-label>Wrap Text</x-label>
              </x-menuitem>
              <x-menuitem @click.prevent="copy">
                <x-label>Copy</x-label>
              </x-menuitem>
            </x-menu>
          </x-button>
        </div>
      </div>

      <div class="text-editor-wrapper">
        <text-editor
          :language-id="languageId"
          :value="content"
          :read-only="readOnly"
          :line-wrapping="wrapText"
          :force-initialize="reinitializeTextEditor"
          :replace-extensions="replaceExtensions"
          :fold-gutters="isJson"
          :line-numbers="false"
          @bks-value-change="handleValueChange"
        />
      </div>

      <span class="error-message" v-if="error">{{ error }}</span>

      <div class="footer">
        <span class="expand" />
        <button
          class="btn btn-flat btn-sm"
          @click.prevent="revert"
          :disabled="!dirty"
        >
          Revert
        </button>
        <button
          class="btn btn-primary btn-sm"
          @click.prevent="apply"
          :disabled="readOnly || error || !dirty"
        >
          Apply
        </button>
      </div>
    </template>

    <div class="empty-text" v-else>
      Double-click a cell to edit it here
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Edits a single cell's value as the root document, rather than showing the
 * whole row like JsonViewer does. Applying writes back through the cell's
 * setValue so it joins the normal pending-changes flow.
 *
 * JSON columns get folding, format/minify and validation; text columns are
 * edited as-is, since there's nothing to parse or reformat.
 */
import Vue from "vue";
import _ from "lodash";
import { mapGetters } from "vuex";
import TextEditor from "@beekeeperstudio/ui-kit/vue/text-editor";
import { AppEvent } from "@/common/AppEvent";
import { monokaiInit } from "@uiw/codemirror-theme-monokai";
import { typedArrayToString } from "@/common/utils";
import { Languages } from "@/lib/editor/languageData";

const JsonLanguage = Languages.find((lang) => lang.name === "json");

export default Vue.extend({
  name: "CellEditorDrawer",
  components: { TextEditor },
  data() {
    return {
      hasCell: false,
      columnName: "",
      dataType: "",
      readOnly: false,
      mode: "text",
      array: false,
      content: "",
      dirty: false,
      error: null,
      wrapText: false,
      reinitializeTextEditor: 0,
    };
  },
  computed: {
    ...mapGetters({ settings: "settings/settings" }),
    userKeymap() {
      const value = this.settings?.keymap.value;
      const keymapTypes = this.$config.defaults.keymapTypes;
      return value && keymapTypes.map((k) => k.value).includes(value) ? value : "default";
    },
    isJson() {
      return this.mode === "json";
    },
    languageId() {
      return this.isJson ? "json" : undefined;
    },
    rootBindings() {
      return [
        { event: AppEvent.openCellEditorDrawer, handler: this.open },
        { event: AppEvent.switchingTab, handler: this.reset },
        { event: AppEvent.closingTab, handler: this.reset },
      ];
    },
  },
  created() {
    // Non-reactive on purpose: Vue 2 deep observes data(), and a CellComponent
    // transitively holds the row, column and whole table. Only setValue() is
    // ever called on it, so observing it is pure cost.
    this.cell = null;
    this.originalContent = "";
  },
  methods: {
    async open(payload) {
      this.cell = payload.cell;
      this.hasCell = true;
      this.columnName = payload.columnName;
      this.dataType = payload.dataType;
      this.readOnly = payload.readOnly;
      this.mode = payload.mode;
      this.array = !!payload.array;
      // Text wraps by default; JSON is pretty-printed so it usually doesn't need to.
      this.wrapText = payload.mode === "text";
      this.setContent(this.stringify(payload.value));
      // The sidebar pane is expanding as this fires, so the editor would
      // otherwise measure itself inside a zero-width container.
      await this.$nextTick();
      this.reinitializeTextEditor++;
    },
    reset() {
      this.cell = null;
      this.hasCell = false;
      this.columnName = "";
      this.dataType = "";
      this.readOnly = false;
      this.setContent("");
    },
    setContent(text: string) {
      this.originalContent = text;
      this.content = text;
      this.dirty = false;
      this.error = null;
    },
    handleValueChange(event) {
      this.content = event.value;
      this.dirty = this.content !== this.originalContent;
      this.validate();
    },
    // Debounced, not a computed: parsing a multi-MB document on every keystroke
    // would lock the editor. apply() re-checks before writing.
    validate: _.debounce(function () {
      // An empty editor means NULL, which is valid.
      if (!this.isJson || this.content.trim() === "") {
        this.error = null;
        return;
      }
      try {
        JSON.parse(this.content);
        this.error = null;
      } catch (e) {
        // Not isValid(): it discards the parser's line/column.
        this.error = e.message;
      }
    }, 250),
    // jsonb often arrives already parsed, json usually as a string. Unparseable
    // values fall through as-is so bad data stays visible rather than lost.
    stringify(value) {
      if (value == null) return "";
      if (_.isTypedArray(value)) {
        value = typedArrayToString(value, this.$bksConfig.ui.general.binaryEncoding);
      }
      if (typeof value !== "string") {
        return this.isJson ? JSON.stringify(value, null, 2) : String(value);
      }
      if (!this.isJson) return value;
      try {
        return JsonLanguage.beautify(value);
      } catch {
        return value;
      }
    },
    /** Pass an indent to format, omit it to minify. */
    reformat(indent?: number) {
      try {
        this.content = indent
          ? JsonLanguage.beautify(this.content)
          : JsonLanguage.minify(this.content);
        this.dirty = this.content !== this.originalContent;
        this.reinitializeTextEditor++;
      } catch {
        // Invalid content stays put; the error message explains why.
      }
    },
    /**
     * Esc hides the sidebar but deliberately keeps the buffer, so reopening the
     * same cell restores unsaved edits and closing never destroys work. In vim
     * mode Esc leaves insert mode instead (same exception as EditorModal).
     *
     * Bound on the document rather than the drawer element: the drawer isn't
     * focusable, so a local listener never fires -- the key goes to whatever
     * has focus, usually the grid. Esc therefore closes the drawer from
     * anywhere, except while a cell is being edited inline, where Esc already
     * means "cancel this edit".
     */
    handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || this.userKeymap === "vim") return;
      if (!this.hasCell) return;
      if (document.querySelector(".tabulator-editing")) return;

      e.preventDefault();
      e.stopPropagation();
      this.trigger(AppEvent.toggleSecondarySidebar, false);
    },
    copy() {
      this.$native.clipboard.writeText(this.content);
      this.$noty.success("Copied the data to your clipboard!");
    },
    revert() {
      this.setContent(this.originalContent);
      this.reinitializeTextEditor++;
    },
    apply() {
      if (this.readOnly || this.error || !this.cell) return;
      // An empty editor means NULL rather than an empty string, matching what
      // "Set as NULL" does elsewhere.
      const trimmed = this.content.trim();
      if (trimmed === "") {
        this.cell.setValue(null);
      } else {
        // Array columns hold a real array, not its text form -- the inline
        // editor parses too (see preserveObject in NullableInputEditor).
        this.cell.setValue(this.array ? JSON.parse(this.content) : this.content);
      }
      this.setContent(this.content);
    },
    replaceExtensions(extensions) {
      return [
        extensions,
        monokaiInit({
          settings: {
            selection: "",
            selectionMatch: "",
          },
        }),
      ];
    },
  },
  mounted() {
    this.registerHandlers(this.rootBindings);
    // Capture phase: CodeMirror handles Esc itself and would otherwise consume it.
    document.addEventListener("keydown", this.handleKeyDown, true);
  },
  beforeDestroy() {
    this.validate.cancel();
    this.unregisterHandlers(this.rootBindings);
    document.removeEventListener("keydown", this.handleKeyDown, true);
  },
});
</script>

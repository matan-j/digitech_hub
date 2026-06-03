'use client';

/**
 * @deprecated Use `<NodeEditor kind="lesson" ... />` directly. This shim keeps
 * unrelated import sites compiling for one release while CourseEditorV1 migrates.
 */
import NodeEditor from './NodeEditor';
import type { DbLesson } from '@/lib/learn/types';

type Props = {
  lesson: DbLesson;
  onChange: (next: DbLesson) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
};

export default function DbLessonRow({ lesson, onChange, onDelete, onDragStart, onDragOver, onDrop }: Props) {
  return (
    <NodeEditor
      kind="lesson"
      node={lesson}
      onChange={onChange}
      onDelete={onDelete}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    />
  );
}

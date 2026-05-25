'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import styles from './DeleteConfirmationModal.module.css';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmationModal({
  isOpen,
  title = 'Delete Item?',
  message = 'Are you sure you want to delete this? This action cannot be undone.',
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
        >
          <motion.div
            className={styles.dialog}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <div className={styles.iconWrapper}>
                <AlertTriangle size={20} className={styles.icon} />
              </div>
              <h2 className={styles.title}>{title}</h2>
              <button className={styles.closeBtn} onClick={onCancel}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.content}>
              <p className={styles.message}>{message}</p>
              
              <div className={styles.actions}>
                <button className={styles.cancelBtn} onClick={onCancel}>
                  Cancel
                </button>
                <button className={styles.confirmBtn} onClick={onConfirm}>
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

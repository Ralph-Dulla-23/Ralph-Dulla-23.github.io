package com.ralph.diary;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(DiaryMediaStorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
